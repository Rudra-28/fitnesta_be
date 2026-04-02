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

module.exports = { getUpcomingSessions, getSessionHistory };
