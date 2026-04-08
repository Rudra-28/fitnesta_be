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
 * Uses the standard cap (18/month) and generates exactly that many sessions
 * forward from start_date on the selected days_of_week.
 *
 * Body: { session_type, student_id, professional_id, activity_id (IC only),
 *         start_date, days_of_week: ["Monday","Wednesday",...], start_time, end_time }
 */
async function generateIndividualSessions({
  session_type,
  student_id,
  professional_id,
  activity_id,
  start_date,
  days_of_week,
  start_time,
  end_time,
}) {
  if (!["personal_tutor", "individual_coaching"].includes(session_type)) {
    throw Object.assign(new Error("session_type must be personal_tutor or individual_coaching"), { code: "INVALID_SESSION_TYPE" });
  }
  if (!student_id || !professional_id || !start_date || !days_of_week?.length || !start_time || !end_time) {
    throw Object.assign(new Error("student_id, professional_id, start_date, days_of_week, start_time, end_time are required"), { code: "MISSING_FIELDS" });
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

  // Resolve standard cap from commission_rules
  const capRuleKey = session_type === "personal_tutor"
      ? "personal_tutor_sessions_cap"
      : "individual_coaching_sessions_cap";
  const capRule     = await prisma.commission_rules.findUnique({ where: { rule_key: capRuleKey } });
  const sessionCap  = capRule ? parseInt(capRule.value) : 18;

  const DAY_NAMES   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const startTimeDt = parseTimeString(start_time);
  const endTimeDt   = parseTimeString(end_time);
  const startDt     = new Date(start_date);
  startDt.setHours(0, 0, 0, 0);

  // Generate exactly sessionCap dates forward on the selected days
  const sessionDates = [];
  const current      = new Date(startDt);
  const maxLookAhead = new Date(startDt.getTime() + 180 * 86400000);

  while (sessionDates.length < sessionCap && current <= maxLookAhead) {
    const dayName = DAY_NAMES[current.getDay()];
    if (days_of_week.includes(dayName)) {
      sessionDates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  if (sessionDates.length === 0) {
    throw Object.assign(new Error("No valid session dates generated from the given days_of_week"), { code: "NO_DAYS_IN_RANGE" });
  }

  // Create sessions — skip dates where professional or student has a conflict
  const created  = [];
  const skipped  = [];

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

  // Auto-assign professional to student record if not already done
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

  return {
    session_type,
    standard_cap:   sessionCap,
    generated:      created.length,
    skipped:        skipped.length,
    skipped_detail: skipped,
    session_ids:    created,
    cycle_start:    startDt,
    cycle_end:      sessionDates[sessionDates.length - 1],
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

async function getSessionFeedback(sessionId) {
  return repo.getSessionFeedback(sessionId);
}

module.exports = {
  createIndividualSession,
  generateIndividualSessions,
  getSession,
  listSessions,
  updateSessionStatus,
  cancelSession,
  getSessionFeedback,
};
