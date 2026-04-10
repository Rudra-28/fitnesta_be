const prisma = require("../../../config/prisma");
const repo = require("./sessionrepo");
const adminRepo = require("../adminrepository");
const commissionService = require("../../commissions/commissionservice");

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
 * Generates up to session_cap sessions from start_date → end_date
 * (end_date = start_date + term_months) on the selected days_of_week.
 * Persists the session config and membership window onto the student record.
 *
 * Body: { session_type, student_id, professional_id, activity_id (IC only),
 *         start_date, term_months, session_cap (max 20),
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

  // Resolve cap: use admin-provided cap (max 20), else fall back to commission_rules
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

  // Generate up to resolvedCap session dates within the membership window
  const sessionDates = [];
  const current = new Date(startDt);

  while (sessionDates.length < resolvedCap && current <= endDt) {
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

  return {
    session_type,
    session_cap:        resolvedCap,
    membership_start:   startDt,
    membership_end:     endDt,
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

  const cap       = record.session_cap ?? 20;
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

  // Count existing non-cancelled sessions
  const existingCount = await prisma.sessions.count({
    where: {
      student_id: Number(student_id),
      session_type,
      status: { not: "cancelled" },
    },
  });

  const remaining = cap - existingCount;
  const capWarning = remaining <= 0
    ? `Session cap of ${cap} already reached. No new sessions will be generated unless cap is increased.`
    : null;

  // Generate new session dates from oldEndDt+1 → newEndDt, up to remaining cap
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const appendStart = new Date(oldEndDt);
  appendStart.setDate(appendStart.getDate() + 1);

  const sessionDates = [];
  const current = new Date(appendStart);

  while (sessionDates.length < Math.max(remaining, 0) && current <= newEndDt) {
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
    sessions_before:    existingCount,
    cap,
    cap_warning:        capWarning,
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

async function listSessions(filters) {
  return repo.listSessions(filters);
}

async function updateSessionStatus(sessionId, status, cancel_reason) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });

  if (session.status === "completed" || session.status === "cancelled") {
    throw Object.assign(new Error(`Cannot update a ${session.status} session`), { code: "SESSION_ALREADY_FINAL" });
  }

  if (status === "cancelled" && !cancel_reason) {
    throw Object.assign(new Error("cancel_reason is required when cancelling a session"), { code: "MISSING_FIELDS" });
  }

  return repo.updateSessionStatus(sessionId, status, cancel_reason);
}

async function cancelSession(sessionId, cancel_reason) {
  return updateSessionStatus(sessionId, "cancelled", cancel_reason);
}

async function rescheduleSession(sessionId, { scheduled_date, start_time, end_time }) {
  const session = await repo.getSessionById(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });

  if (session.status === "completed" || session.status === "cancelled") {
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

  return repo.rescheduleSession(sessionId, { scheduled_date: date, start_time: startTimeDt, end_time: endTimeDt });
}

async function getStudentSessionBatches(studentId) {
  return repo.getStudentSessionBatches(studentId);
}

/**
 * Preview session generation: given the same inputs as generateIndividualSessions,
 * return a month-by-month breakdown of how many sessions would be created —
 * without writing anything to the database.
 *
 * Response: { term_months, session_cap, total_sessions, months: [{ month_label, month_number, start, end, sessions_count }] }
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

  // Load session cap from commission_rules
  const capRuleKey = session_type === "personal_tutor"
    ? "personal_tutor_sessions_cap"
    : "individual_coaching_sessions_cap";
  const capRule = await prisma.commission_rules.findUnique({ where: { rule_key: capRuleKey } });
  const session_cap = capRule ? parseInt(capRule.value) : 18;

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const startDt   = new Date(start_date);
  startDt.setHours(0, 0, 0, 0);

  // Build per-month breakdown
  const months = [];
  let totalSessions = 0;
  let remaining = session_cap;

  for (let m = 0; m < term_months; m++) {
    const monthStart = new Date(startDt);
    monthStart.setMonth(monthStart.getMonth() + m);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    // Last day of that month window (exclusive)
    const windowEnd = m === term_months - 1 ? monthEnd : monthEnd;

    let count = 0;
    const cur = new Date(monthStart);
    while (cur < windowEnd && remaining > 0) {
      if (days_of_week.includes(DAY_NAMES[cur.getDay()])) {
        count++;
        remaining--;
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
    if (remaining <= 0) break;
  }

  return {
    session_type,
    term_months,
    session_cap,
    total_sessions: totalSessions,
    membership_start: startDt.toISOString().slice(0, 10),
    membership_end:   (() => { const e = new Date(startDt); e.setMonth(e.getMonth() + term_months); return e.toISOString().slice(0, 10); })(),
    months,
  };
}

async function getSessionFeedback(sessionId) {
  return repo.getSessionFeedback(sessionId);
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
};
