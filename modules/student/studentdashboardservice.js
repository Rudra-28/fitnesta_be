const repo = require("./studentdashboardrepo");

async function getUpcomingSessions(userId) {
  const studentId = await repo.getStudentIdByUserId(userId);
  if (!studentId) throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" });
  return repo.getUpcomingSessions(studentId);
}

async function getSessionHistory(userId) {
  const studentId = await repo.getStudentIdByUserId(userId);
  if (!studentId) throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" });
  return repo.getSessionHistory(studentId);
}

async function submitFeedback(userId, sessionId, rating, comment) {
  const studentId = await repo.getStudentIdByUserId(userId);
  if (!studentId) throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" });
  if (!rating || rating < 1 || rating > 5) throw Object.assign(new Error("rating must be 1–5"), { code: "INVALID" });
  return repo.submitFeedback(studentId, Number(sessionId), rating, comment);
}

module.exports = { getUpcomingSessions, getSessionHistory, submitFeedback };
