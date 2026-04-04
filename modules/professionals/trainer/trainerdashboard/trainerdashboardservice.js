const repo             = require("./trainerdashboardrepo");
const commissionRepo   = require("../../../commissions/commissionrepo");
const withdrawalService = require("../../../commissions/withdrawalservice");

const VALID_STATUSES = ["upcoming", "ongoing", "completed", "cancelled"];

async function getSessions(userId, status = "upcoming") {
  if (!VALID_STATUSES.includes(status)) {
    throw Object.assign(new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`), { code: "BAD_REQUEST" });
  }
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return repo.getSessions(professionalId, status);
}

async function getTrainerBatches(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return repo.getTrainerBatches(professionalId);
}

async function getBatchSessions(userId, batchId, status) {
  const VALID = ["upcoming", "ongoing", "completed", "cancelled"];
  if (status && !VALID.includes(status)) {
    throw Object.assign(new Error(`Invalid status. Allowed: ${VALID.join(", ")}`), { code: "BAD_REQUEST" });
  }
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return repo.getBatchSessions(batchId, professionalId, status);
}

async function getAllStudents(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  const rows = await repo.getAllStudentsWithProgress(professionalId);
  return rows.map((r) => {
    const sessions   = r.students?.sessions ?? [];
    const total      = sessions.length;
    const completed  = sessions.filter((s) => s.status === "completed").length;
    return {
      student_id:      r.students?.id ?? null,
      full_name:       r.students?.users?.full_name ?? null,
      mobile:          r.students?.users?.mobile ?? null,
      email:           r.students?.users?.email ?? null,
      photo:           r.students?.users?.photo ?? null,
      student_type:    r.students?.student_type ?? null,
      batch:           { id: r.batches?.id, name: r.batches?.batch_name, activity: r.batches?.activities, society: r.batches?.societies ?? null, school: r.batches?.schools ?? null },
      joined_at:       r.joined_at,
      session_progress: { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 },
    };
  });
}

async function getStudentSessions(userId, studentId, status) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  const VALID = ["upcoming", "ongoing", "completed", "cancelled"];
  if (status && !VALID.includes(status)) {
    throw Object.assign(new Error(`Invalid status. Allowed: ${VALID.join(", ")}`), { code: "BAD_REQUEST" });
  }
  return repo.getStudentSessions(professionalId, studentId, status);
}

async function getBatchesByLocation(userId, location) {
  if (!["society", "school"].includes(location)) {
    throw Object.assign(new Error("Invalid location. Allowed: society, school"), { code: "BAD_REQUEST" });
  }
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  const batches = await repo.getBatchesByLocation(professionalId, location);
  return batches.map((b) => {
    const completed = b.sessions.filter((s) => s.status === "completed").length;
    const total     = b.sessions.length;
    return {
      batch_id:           b.id,
      batch_name:         b.batch_name,
      activity:           b.activities,
      location:           b.societies ?? b.schools,
      total_students:     b._count.batch_students,
      total_sessions:     total,
      completed_sessions: completed,
      pending_sessions:   total - completed,
      progress_percent:   total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
}

async function getActivities(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return repo.getActivitiesWithBatchStats(professionalId);
}

async function getBatchStudents(userId, batchId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  const data = await repo.getBatchStudents(batchId, professionalId);
  if (!data) throw Object.assign(new Error("Batch not found"), { code: "NOT_FOUND" });
  return data;
}

async function getSessionById(userId, sessionId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  const session = await repo.getSessionById(sessionId, professionalId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" });
  return session;
}

async function punchIn(userId, sessionId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  const session = await repo.getSessionForTrainer(sessionId, professionalId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });
  if (session.status !== "scheduled") throw Object.assign(new Error("Session must be in scheduled status to punch in"), { code: "INVALID_STATUS" });
  return repo.punchIn(sessionId);
}

async function punchOut(userId, sessionId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  const session = await repo.getSessionForTrainer(sessionId, professionalId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "SESSION_NOT_FOUND" });
  if (session.status !== "ongoing") throw Object.assign(new Error("Session must be ongoing to punch out"), { code: "INVALID_STATUS" });
  return repo.punchOut(sessionId);
}

const VALID_WALLET_STATUSES = ["pending", "approved", "requested", "paid"];

async function getWalletSummary(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return commissionRepo.getWalletSummary(professionalId);
}

async function getWalletBreakdown(userId, status) {
  if (!VALID_WALLET_STATUSES.includes(status))
    throw Object.assign(new Error(`Invalid status. Allowed: ${VALID_WALLET_STATUSES.join(", ")}`), { code: "BAD_REQUEST" });
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return commissionRepo.getWalletBreakdown(professionalId, status);
}

async function requestWithdrawal(userId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return withdrawalService.requestWithdrawal(professionalId);
}

async function saveUpiId(userId, upiId) {
  const professionalId = await repo.getTrainerProfessionalId(userId);
  if (!professionalId) throw Object.assign(new Error("Trainer profile not found"), { code: "NOT_FOUND" });
  return withdrawalService.saveUpiId(professionalId, upiId);
}

module.exports = { getSessions, getSessionById, getTrainerBatches, getBatchesByLocation, getActivities, getBatchStudents, getBatchSessions, getAllStudents, getStudentSessions, punchIn, punchOut, getWalletSummary, getWalletBreakdown, requestWithdrawal, saveUpiId };
