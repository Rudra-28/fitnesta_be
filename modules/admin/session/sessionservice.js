const prisma = require("../../../config/prisma");
const repo = require("./sessionrepo");

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

  return repo.createSession({
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
  getSession,
  listSessions,
  updateSessionStatus,
  cancelSession,
  getSessionFeedback,
};
