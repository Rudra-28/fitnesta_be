const prisma = require("../../../config/prisma");
const repo = require("./sessionrepo");
const adminRepo = require("../adminrepository");
const commissionService = require("../../commissions/commissionservice");
const notify = require("../../../utils/notifications");

function parseTimeString(timeStr) {
  if (timeStr instanceof Date) return timeStr;
  const [h, m, s = "0"] = String(timeStr).split(":");
  return new Date(1970, 0, 1, Number(h), Number(m), Number(s));
}

async function createIndividualSession({
  session_type,
  student_id,
  professional_id,
  scheduled_date,
  start_time,
  end_time,
  activity_id,
}) {
  // Only personal_tutor and individual_coaching are allowed as individual sessions
  if (!["personal_tutor", "individual_coaching"].includes(session_type)) {
    throw Object.assign(
      new Error("Individual sessions can only be of type personal_tutor or individual_coaching"),
      { code: "INVALID_SESSION_TYPE" }
    );
  }

  if (!student_id || !professional_id || !scheduled_date || !start_time || !end_time) {
    throw Object.assign(new Error("student_id, professional_id, scheduled_date, start_time, end_time are required"), {
      code: "MISSING_FIELDS",
    });
  }

  if (session_type === "individual_coaching" && !activity_id) {
    throw Object.assign(new Error("activity_id is required for individual_coaching sessions"), {
      code: "MISSING_FIELDS",
    });
  }

  const date = new Date(scheduled_date);
  const startTimeDt = parseTimeString(start_time);
  const endTimeDt = parseTimeString(end_time);

  // Validate student
  const student = await prisma.students.findUnique({ where: { id: Number(student_id) } });
  if (!student) throw Object.assign(new Error("Student not found"), { code: "STUDENT_NOT_FOUND" });

  // Validate professional
  const professional = await prisma.professionals.findUnique({
    where: { id: Number(professional_id) },
    include: { users: { select: { approval_status: true } } },
  });
  if (!professional || professional.users?.approval_status !== "approved") {
    throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
  }

  // Conflict checks
  const professionalConflict = await repo.checkProfessionalConflict(
    Number(professional_id),
    date,
    startTimeDt,
    endTimeDt
  );
  if (professionalConflict) {
    throw Object.assign(new Error("Professional is already booked at this date and time"), {
      code: "PROFESSIONAL_CONFLICT",
    });
  }

  const studentConflict = await repo.checkStudentConflict(Number(student_id), date, startTimeDt, endTimeDt);
  if (studentConflict) {
    throw Object.assign(new Error("Student already has a session at this date and time"), {
      code: "STUDENT_CONFLICT",
    });
  }

  const session = await repo.createSession({
    session_type,
    batch_id: null,
    activity_id: activity_id ? Number(activity_id) : null,
    student_id: Number(student_id),
    professional_id: Number(professional_id),
    scheduled_date: date,
    start_time: startTimeDt,
    end_time: endTimeDt,
    status: "scheduled",
  });

  notify.notifySessionCreated(session).catch(() => {});

  // Auto-assign the professional to the student record if not already assigned
  if (session_type === "personal_tutor") {
    const pt = await adminRepo.findPersonalTutorByStudentId(student_id);
    if (pt && !pt.teacher_professional_id) {
      await adminRepo.assignTeacherToStudent(pt.id, Number(professional_id));
      await commissionService.recordTeacherAssignment(pt.id, Number(professional_id));
    }
  } else if (session_type === "individual_coaching") {
    const ip = await adminRepo.findIndividualParticipantByStudentId(student_id);
    if (ip && !ip.trainer_professional_id) {
      await adminRepo.assignTrainerToStudent(ip.id, Number(professional_id));
      await commissionService.recordTrainerAssignment(ip.id, Number(professional_id));
    }
  }

  return session;
}

/**
 * Auto-generate sessions for individual_coaching or personal_tutor.
 * Generates ALL eligible sessions from start_date → end_date
 * (end_date = start_date + term_months) on the selected days_of_week.
 *
 * NOTE: session_cap is the commission cap (max 18 sessions/month used for
 * commission calculation). It is stored on the student record for internal
 * use — it does NOT limit how many sessions are created here.
 *
 * Body: { session_type, student_id, professional_id, activity_id (IC only),
 *         start_date, term_months, session_cap (commission cap, max 20),
 *         days_of_week: ["Monday","Wednesday",...], start_time, end_time }
 */
async function generateIndividualSessions({
  session_type,
  student_id,
  professional_id,
  activity_id,
  start_date,
  term_months,
  session_cap,
  days_of_week,
  start_time,
  end_time,
}) {
  if (!["personal_tutor", "individual_coaching"].includes(session_type)) {
    throw Object.assign(new Error("session_type must be personal_tutor or individual_coaching"), { code: "INVALID_SESSION_TYPE" });
  }
  if (!student_id || !professional_id || !start_date || !term_months || !days_of_week?.length || !start_time || !end_time) {
    throw Object.assign(new Error("student_id, professional_id, start_date, term_months, days_of_week, start_time, end_time are required"), { code: "MISSING_FIELDS" });
  }
  if (session_type === "individual_coaching" && !activity_id) {
    throw Object.assign(new Error("activity_id is required for individual_coaching"), { code: "MISSING_FIELDS" });
  }

  // Validate student + professional
  const student = await prisma.students.findUnique({ where: { id: Number(student_id) } });
  if (!student) throw Object.assign(new Error("Student not found"), { code: "STUDENT_NOT_FOUND" });

  const professional = await prisma.professionals.findUnique({
    where: { id: Number(professional_id) },
    include: { users: { select: { approval_status: true } } },
  });
  if (!professional || professional.users?.approval_status !== "approved") {
    throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
  }

  // Resolve commission cap: used for commission tracking only, NOT for limiting session creation.
  // Use admin-provided cap (max 20), else fall back to commission_rules.
  let resolvedCap = session_cap ? Math.min(parseInt(session_cap), 20) : null;
  if (!resolvedCap) {
    const capRuleKey = session_type === "personal_tutor"
        ? "personal_tutor_sessions_cap"
        : "individual_coaching_sessions_cap";
    const capRule = await prisma.commission_rules.findUnique({ where: { rule_key: capRuleKey } });
    resolvedCap = capRule ? Math.min(parseInt(capRule.value), 20) : 18;
  }

  const DAY_NAMES   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const startTimeDt = parseTimeString(start_time);
  const endTimeDt   = parseTimeString(end_time);
  const startDt     = new Date(start_date);
  startDt.setHours(0, 0, 0, 0);

  // Compute membership end date from term_months
  const endDt = new Date(startDt);
  endDt.setMonth(endDt.getMonth() + parseInt(term_months));

  // Generate ALL eligible session dates within the full membership window.
  // The commission cap (resolvedCap) is stored on the record separately — it does not
  // limit how many sessions are scheduled for the student.
  const sessionDates = [];
  const current = new Date(startDt);

  while (current <= endDt) {
    const dayName = DAY_NAMES[current.getDay()];
    if (days_of_week.includes(dayName)) {
      sessionDates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  if (sessionDates.length === 0) {
    throw Object.assign(new Error("No valid session dates generated from the given days_of_week within the membership period"), { code: "NO_DAYS_IN_RANGE" });
  }

  // Create sessions — skip dates where professional or student has a conflict
  const created = [];
  const skipped = [];

  for (const date of sessionDates) {
    const profConflict = await repo.checkProfessionalConflict(Number(professional_id), date, startTimeDt, endTimeDt);
    if (profConflict) { skipped.push({ date: date.toISOString().slice(0, 10), reason: "professional_conflict" }); continue; }

    const stuConflict = await repo.checkStudentConflict(Number(student_id), date, startTimeDt, endTimeDt);
    if (stuConflict) { skipped.push({ date: date.toISOString().slice(0, 10), reason: "student_conflict" }); continue; }

    const session = await repo.createSession({
      session_type,
      batch_id:        null,
      activity_id:     activity_id ? Number(activity_id) : null,
      student_id:      Number(student_id),
      professional_id: Number(professional_id),
      scheduled_date:  date,
      start_time:      startTimeDt,
      end_time:        endTimeDt,
      status:          "scheduled",
    });
    created.push(session.id);
  }

  // Persist session config + membership window onto the student record
  const membershipData = {
    membership_start_date: startDt,
    membership_end_date:   endDt,
    session_cap:           resolvedCap,
    session_days_of_week:  days_of_week,
    session_start_time:    startTimeDt,
    session_end_time:      endTimeDt,
    is_active:             true,
  };

  if (session_type === "personal_tutor") {
    const pt = await adminRepo.findPersonalTutorByStudentId(student_id);
    if (pt) {
      await prisma.personal_tutors.update({ where: { id: pt.id }, data: membershipData });
      if (!pt.teacher_professional_id) {
        await adminRepo.assignTeacherToStudent(pt.id, Number(professional_id));
        await commissionService.recordTeacherAssignment(pt.id, Number(professional_id));
      }
    }
  } else if (session_type === "individual_coaching") {
    const ip = await adminRepo.findIndividualParticipantByStudentId(student_id);
    if (ip) {
      await prisma.individual_participants.update({ where: { id: ip.id }, data: membershipData });
      if (!ip.trainer_professional_id) {
        await adminRepo.assignTrainerToStudent(ip.id, Number(professional_id));
        await commissionService.recordTrainerAssignment(ip.id, Number(professional_id));
      }
    }
  }

  if (created.length > 0) {
    notify.notifySessionsGenerated(student_id, professional_id, created.length, session_type).catch(() => {});
  }

  return {
    session_type,
    commission_cap:     resolvedCap,   // max sessions counted for commission (not a session limit)
    membership_start:   startDt,
    membership_end:     endDt,
    total_scheduled:    created.length + skipped.length,
    generated:          created.length,
    skipped:            skipped.length,
    skipped_detail:     skipped,
    session_ids:        created,
  };
}

/**
 * Extend a student's membership end date and append new sessions.
 * Body: { session_type, student_id, new_end_date }
 *
 * - Reads stored days_of_week / timing / cap from the student record
 * - Appends sessions from old_end_date+1 → new_end_date (up to remaining cap space)
 * - Returns warning if total sessions would exceed cap
 */
async function extendMembership({ session_type, student_id, new_end_date }) {
  if (!["personal_tutor", "individual_coaching"].includes(session_type)) {
    throw Object.assign(new Error("session_type must be personal_tutor or individual_coaching"), { code: "INVALID_SESSION_TYPE" });
  }
  if (!student_id || !new_end_date) {
    throw Object.assign(new Error("student_id and new_end_date are required"), { code: "MISSING_FIELDS" });
  }

  // Load current record
  let record;
  if (session_type === "personal_tutor") {
    record = await adminRepo.findPersonalTutorByStudentId(student_id);
  } else {
    record = await adminRepo.findIndividualParticipantByStudentId(student_id);
  }

  if (!record) {
    throw Object.assign(new Error("Student record not found"), { code: "STUDENT_NOT_FOUND" });
  }
  if (!record.membership_start_date || !record.membership_end_date) {
    throw Object.assign(new Error("No active membership found. Generate sessions first."), { code: "NO_MEMBERSHIP" });
  }
  if (!record.session_days_of_week || !record.session_start_time || !record.session_end_time) {
    throw Object.assign(new Error("Session config missing on record. Cannot extend."), { code: "NO_SESSION_CONFIG" });
  }

  const newEndDt = new Date(new_end_date);
  newEndDt.setHours(0, 0, 0, 0);
  const oldEndDt = new Date(record.membership_end_date);
  oldEndDt.setHours(0, 0, 0, 0);

  if (newEndDt <= oldEndDt) {
    throw Object.assign(new Error("new_end_date must be after the current membership_end_date (" + oldEndDt.toISOString().slice(0, 10) + ")"), { code: "INVALID_DATE" });
  }

  // session_cap is a MONTHLY commission cap — not a lifetime session limit.
  // It is only used by the commission formula as the per-month denominator.
  // It must NEVER limit how many sessions are scheduled.
  const monthlyCap = record.session_cap ?? 20;

  const daysOfWeek = Array.isArray(record.session_days_of_week)
    ? record.session_days_of_week
    : JSON.parse(record.session_days_of_week);
  const startTimeDt = record.session_start_time instanceof Date
    ? record.session_start_time
    : parseTimeString(record.session_start_time);
  const endTimeDt = record.session_end_time instanceof Date
    ? record.session_end_time
    : parseTimeString(record.session_end_time);

  const professionalId = session_type === "personal_tutor"
    ? record.teacher_professional_id
    : record.trainer_professional_id;

  if (!professionalId) {
    throw Object.assign(new Error("No professional assigned to this student yet"), { code: "NO_PROFESSIONAL" });
  }

  // Generate ALL session dates from oldEndDt+1 → newEndDt (no cap limit on count)
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const appendStart = new Date(oldEndDt);
  appendStart.setDate(appendStart.getDate() + 1);

  const sessionDates = [];
  const current = new Date(appendStart);

  while (current <= newEndDt) {
    const dayName = DAY_NAMES[current.getDay()];
    if (daysOfWeek.includes(dayName)) {
      sessionDates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  const created = [];
  const skipped = [];

  for (const date of sessionDates) {
    const profConflict = await repo.checkProfessionalConflict(Number(professionalId), date, startTimeDt, endTimeDt);
    if (profConflict) { skipped.push({ date: date.toISOString().slice(0, 10), reason: "professional_conflict" }); continue; }

    const stuConflict = await repo.checkStudentConflict(Number(student_id), date, startTimeDt, endTimeDt);
    if (stuConflict) { skipped.push({ date: date.toISOString().slice(0, 10), reason: "student_conflict" }); continue; }

    const activityId = session_type === "individual_coaching" ? (record.activity_id ?? null) : null;
    const session = await repo.createSession({
      session_type,
      batch_id:        null,
      activity_id:     activityId,
      student_id:      Number(student_id),
      professional_id: Number(professionalId),
      scheduled_date:  date,
      start_time:      startTimeDt,
      end_time:        endTimeDt,
      status:          "scheduled",
    });
    created.push(session.id);
  }

  // Update membership_end_date on the record
  const table = session_type === "personal_tutor" ? "personal_tutors" : "individual_participants";
  await prisma[table].update({
    where: { id: record.id },
    data:  { membership_end_date: newEndDt, is_active: true },
  });

  return {
    session_type,
    student_id:         Number(student_id),
    new_membership_end: newEndDt,
    monthly_commission_cap: monthlyCap,
    generated:          created.length,
    skipped:            skipped.length,
    skipped_detail:     skipped,
    session_ids:        created,
  };
}

async function getSession(sessionId) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });
  return session;
}

/**
 * Hard-delete a single session.
 * - Cannot delete a completed session (use cancel instead).
 * - Cascades to session_participants and session_feedback.
 */
async function deleteSession(sessionId) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });

  if (session.status === "completed") {
    throw Object.assign(
      new Error("Cannot delete a completed session. Cancel it instead if needed."),
      { code: "SESSION_ALREADY_FINAL" }
    );
  }

  return repo.deleteSession(sessionId);
}

/**
 * Bulk delete all upcoming (scheduled) sessions for a student.
 * Useful when a student's full schedule needs to be wiped (e.g., re-generating).
 *
 * Body: { student_id, session_type, from_date (optional, defaults to today) }
 */
async function bulkDeleteFutureSessions({ student_id, session_type, from_date }) {
  if (!["personal_tutor", "individual_coaching"].includes(session_type)) {
    throw Object.assign(new Error("session_type must be personal_tutor or individual_coaching"), { code: "INVALID_SESSION_TYPE" });
  }
  if (!student_id) {
    throw Object.assign(new Error("student_id is required"), { code: "MISSING_FIELDS" });
  }

  // Default from_date to today so we never delete past sessions
  const resolvedFromDate = from_date ? new Date(from_date) : new Date();
  resolvedFromDate.setHours(0, 0, 0, 0);

  const deleted = await repo.bulkDeleteFutureSessions({
    student_id,
    session_type,
    from_date: resolvedFromDate,
  });

  return { deleted_count: deleted };
}

async function listSessions(filters) {
  return repo.listSessions(filters);
}

async function updateSessionStatus(sessionId, status, cancel_reason) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });

  const FINAL_STATUSES = ["completed", "cancelled", "absent"];
  if (FINAL_STATUSES.includes(session.status)) {
    throw Object.assign(new Error(`Cannot update a ${session.status} session`), { code: "SESSION_ALREADY_FINAL" });
  }

  // Batch sessions (group_coaching / school_student): admin can only cancel.
  // ongoing/completed/absent are set automatically by trainer punch-in/out.
  const BATCH_TYPES = ["group_coaching", "school_student"];
  if (BATCH_TYPES.includes(session.session_type) && status !== "cancelled") {
    throw Object.assign(
      new Error("Batch session status is managed automatically. Admin can only cancel a batch session."),
      { code: "MANUAL_STATUS_NOT_ALLOWED" }
    );
  }

  if (status === "cancelled" && !cancel_reason) {
    throw Object.assign(new Error("cancel_reason is required when cancelling a session"), { code: "MISSING_FIELDS" });
  }

  const updated = await repo.updateSessionStatus(sessionId, status, cancel_reason);
  if (status === "cancelled") {
    notify.notifySessionCancelled(session, cancel_reason).catch(() => {});
  }
  return updated;
}

async function cancelSession(sessionId, cancel_reason) {
  return updateSessionStatus(sessionId, "cancelled", cancel_reason);
}

async function rescheduleSession(sessionId, { scheduled_date, start_time, end_time }) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });

  const FINAL_STATUSES = ["completed", "cancelled", "absent"];
  if (FINAL_STATUSES.includes(session.status)) {
    throw Object.assign(new Error(`Cannot reschedule a ${session.status} session`), { code: "SESSION_ALREADY_FINAL" });
  }

  if (!scheduled_date || !start_time || !end_time) {
    throw Object.assign(new Error("scheduled_date, start_time, end_time are required"), { code: "MISSING_FIELDS" });
  }

  const date        = new Date(scheduled_date);
  const startTimeDt = parseTimeString(start_time);
  const endTimeDt   = parseTimeString(end_time);

  // Conflict check — exclude this session itself
  const profConflict = await repo.checkProfessionalConflict(session.professional_id, date, startTimeDt, endTimeDt, Number(sessionId));
  if (profConflict) {
    throw Object.assign(new Error("Professional is already booked at this date and time"), { code: "PROFESSIONAL_CONFLICT" });
  }

  if (session.student_id) {
    const stuConflict = await repo.checkStudentConflict(session.student_id, date, startTimeDt, endTimeDt, Number(sessionId));
    if (stuConflict) {
      throw Object.assign(new Error("Student already has a session at this date and time"), { code: "STUDENT_CONFLICT" });
    }
  }

  const updated = await repo.rescheduleSession(sessionId, { scheduled_date: date, start_time: startTimeDt, end_time: endTimeDt });
  notify.notifySessionRescheduled(session, { scheduled_date: date, start_time: startTimeDt, end_time: endTimeDt }).catch(() => {});
  return updated;
}

async function getStudentSessionBatches(studentId) {
  return repo.getStudentSessionBatches(studentId);
}

/**
 * Preview session generation: given the same inputs as generateIndividualSessions,
 * return a month-by-month breakdown of how many sessions would be created —
 * without writing anything to the database.
 *
 * Sessions are generated for the FULL term (not capped at commission_cap).
 * commission_cap is returned separately for informational purposes.
 *
 * Response: { term_months, commission_cap, total_sessions, months: [{ month_label, month_number, start, end, sessions_count }] }
 */
async function previewSessionGeneration({
  session_type,
  student_id,
  start_date,
  days_of_week,
}) {
  if (!["personal_tutor", "individual_coaching"].includes(session_type)) {
    throw Object.assign(new Error("session_type must be personal_tutor or individual_coaching"), { code: "INVALID_SESSION_TYPE" });
  }
  if (!student_id || !start_date || !days_of_week?.length) {
    throw Object.assign(new Error("student_id, start_date, days_of_week are required"), { code: "MISSING_FIELDS" });
  }

  // Load term_months from the student record
  let term_months;
  if (session_type === "personal_tutor") {
    const pt = await adminRepo.findPersonalTutorByStudentId(student_id);
    if (!pt) throw Object.assign(new Error("Student personal tutor record not found"), { code: "STUDENT_NOT_FOUND" });
    const full = await prisma.personal_tutors.findUnique({ where: { id: pt.id }, select: { term_months: true } });
    term_months = full?.term_months ?? 1;
  } else {
    const ip = await adminRepo.findIndividualParticipantByStudentId(student_id);
    if (!ip) throw Object.assign(new Error("Student individual participant record not found"), { code: "STUDENT_NOT_FOUND" });
    const full = await prisma.individual_participants.findUnique({ where: { id: ip.id }, select: { term_months: true } });
    term_months = full?.term_months ?? 1;
  }

  // Load commission cap from commission_rules (for informational display only — does NOT limit sessions)
  const capRuleKey = session_type === "personal_tutor"
    ? "personal_tutor_sessions_cap"
    : "individual_coaching_sessions_cap";
  const capRule = await prisma.commission_rules.findUnique({ where: { rule_key: capRuleKey } });
  const commission_cap = capRule ? parseInt(capRule.value) : 18;

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const startDt   = new Date(start_date);
  startDt.setHours(0, 0, 0, 0);

  const endDt = new Date(startDt);
  endDt.setMonth(endDt.getMonth() + parseInt(term_months));

  // Build per-month breakdown across the FULL term — no cap applied to session count
  const months = [];
  let totalSessions = 0;

  for (let m = 0; m < term_months; m++) {
    const monthStart = new Date(startDt);
    monthStart.setMonth(monthStart.getMonth() + m);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    let count = 0;
    const cur = new Date(monthStart);
    while (cur < monthEnd) {
      if (days_of_week.includes(DAY_NAMES[cur.getDay()])) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    const label = monthStart.toLocaleString("en-IN", { month: "long", year: "numeric" });
    months.push({
      month_number:   m + 1,
      month_label:    label,
      start:          monthStart.toISOString().slice(0, 10),
      end:            new Date(monthEnd.getTime() - 86400000).toISOString().slice(0, 10),
      sessions_count: count,
    });
    totalSessions += count;
  }

  return {
    session_type,
    term_months,
    commission_cap,   // max sessions counted for commission — not a scheduling limit
    total_sessions: totalSessions,
    membership_start: startDt.toISOString().slice(0, 10),
    membership_end:   endDt.toISOString().slice(0, 10),
    months,
  };
}

async function getSessionFeedback(sessionId) {
  return repo.getSessionFeedback(sessionId);
}

/**
 * Reassign a single session to a different professional.
 * - Session must be scheduled (not completed/cancelled).
 * - Conflict-checks the new professional at that session's date/time.
 * - No commission impact: settlement reads completed sessions by professional_id,
 *   so the new professional is credited naturally when the session completes.
 */
async function reassignSingleSession(sessionId, newProfessionalId) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });

  if (["completed", "cancelled", "absent"].includes(session.status)) {
    throw Object.assign(
      new Error(`Cannot reassign a ${session.status} session`),
      { code: "SESSION_ALREADY_FINAL" }
    );
  }

  const professional = await prisma.professionals.findUnique({
    where: { id: Number(newProfessionalId) },
    include: { users: { select: { approval_status: true } } },
  });
  if (!professional || professional.users?.approval_status !== "approved") {
    throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
  }

  // Conflict-check for the new professional (exclude this session itself)
  const conflict = await repo.checkProfessionalConflict(
    Number(newProfessionalId),
    session.scheduled_date,
    session.start_time,
    session.end_time,
    Number(sessionId)
  );
  if (conflict) {
    throw Object.assign(new Error("New professional is already booked at this date and time"), {
      code: "PROFESSIONAL_CONFLICT",
    });
  }

  const updated = await repo.reassignSingleSession(sessionId, newProfessionalId);
  notify.notifySessionReassigned(session, Number(newProfessionalId)).catch(() => {});

  if (session.session_type === "personal_tutor" && session.student_id) {
    const pt = await adminRepo.findPersonalTutorByStudentId(session.student_id);
    if (pt) {
      await commissionService.recordTeacherAssignment(pt.id, Number(newProfessionalId));
    }
  } else if (session.session_type === "individual_coaching" && session.student_id) {
    const ip = await adminRepo.findIndividualParticipantByStudentId(session.student_id);
    if (ip) {
      await commissionService.recordTrainerAssignment(ip.id, Number(newProfessionalId));
    }
  }

  return updated;
}

/**
 * Reassign all future scheduled sessions for a student to a new professional.
 *
 * Commission impact:
 * - Deactivates the old professional's trainer_assignments record for this student
 *   so their commission cycle stops (their already-completed sessions are still
 *   settled at the next settlement run before deactivation takes effect).
 * - Creates a new trainer_assignments record for the new professional starting today,
 *   so future settlements attribute correctly.
 * - Updates teacher_professional_id / trainer_professional_id on the student record.
 *
 * Body: { session_type, student_id, new_professional_id }
 */
async function reassignAllFutureSessions({ session_type, student_id, new_professional_id }) {
  if (!["personal_tutor", "individual_coaching"].includes(session_type)) {
    throw Object.assign(new Error("session_type must be personal_tutor or individual_coaching"), { code: "INVALID_SESSION_TYPE" });
  }
  if (!student_id || !new_professional_id) {
    throw Object.assign(new Error("student_id and new_professional_id are required"), { code: "MISSING_FIELDS" });
  }

  const professional = await prisma.professionals.findUnique({
    where: { id: Number(new_professional_id) },
    include: { users: { select: { approval_status: true } } },
  });
  if (!professional || professional.users?.approval_status !== "approved") {
    throw Object.assign(new Error("Professional not found or not approved"), { code: "PROFESSIONAL_NOT_FOUND" });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const updatedCount = await repo.reassignFutureSessions({
    student_id,
    session_type,
    new_professional_id,
    from_date: today,
  });

  let oldProfId = null;

  // Update student record and trainer_assignments
  if (session_type === "personal_tutor") {
    const pt = await adminRepo.findPersonalTutorByStudentId(student_id);
    if (pt) {
      oldProfId = pt.teacher_professional_id ?? null;
      if (pt.teacher_professional_id && pt.teacher_professional_id !== Number(new_professional_id)) {
        await prisma.trainer_assignments.updateMany({
          where: {
            professional_id: pt.teacher_professional_id,
            assignment_type: "personal_tutor",
            is_active:       true,
          },
          data: { is_active: false },
        });
      }
      await adminRepo.assignTeacherToStudent(pt.id, Number(new_professional_id));
      await commissionService.recordTeacherAssignment(pt.id, Number(new_professional_id));
    }
  } else {
    const ip = await adminRepo.findIndividualParticipantByStudentId(student_id);
    if (ip) {
      oldProfId = ip.trainer_professional_id ?? null;
      if (ip.trainer_professional_id && ip.trainer_professional_id !== Number(new_professional_id)) {
        await prisma.trainer_assignments.updateMany({
          where: {
            professional_id: ip.trainer_professional_id,
            assignment_type: "individual_coaching",
            is_active:       true,
          },
          data: { is_active: false },
        });
      }
      await adminRepo.assignTrainerToStudent(ip.id, Number(new_professional_id));
      await commissionService.recordTrainerAssignment(ip.id, Number(new_professional_id));
    }
  }

  notify.notifyAllSessionsReassigned(student_id, oldProfId, Number(new_professional_id), session_type).catch(() => {});

  return { updated_sessions: updatedCount, new_professional_id: Number(new_professional_id) };
}

module.exports = {
  createIndividualSession,
  generateIndividualSessions,
  extendMembership,
  getSession,
  listSessions,
  updateSessionStatus,
  cancelSession,
  rescheduleSession,
  getStudentSessionBatches,
  getSessionFeedback,
  previewSessionGeneration,
  deleteSession,
  bulkDeleteFutureSessions,
  reassignSingleSession,
  reassignAllFutureSessions,
};
