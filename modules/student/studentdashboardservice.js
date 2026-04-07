const repo = require("./studentdashboardrepo");
const subjectAddon = require("./subjectaddon/subjectaddonservice");

async function _getStudent(userId) {
  const student = await repo.getStudentIdByUserId(userId);
  if (!student) throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" });
  return student;
}

function _validStatus(status) {
  const valid = ["upcoming", "ongoing", "completed", "cancelled"];
  return valid.includes(status) ? status : null;
}

async function getToggleState(userId) {
  const s = await _getStudent(userId);
  return repo.getToggleState(s.id);
}

async function getSubjectsDashboardStats(userId) {
  const s = await _getStudent(userId);
  return repo.getSubjectsDashboardStats(s.id);
}

async function getActivitiesDashboardStats(userId) {
  const s = await _getStudent(userId);
  return repo.getActivitiesDashboardStats(s.id);
}

async function getSubjectsReminder(userId) {
  const s = await _getStudent(userId);
  return repo.getSubjectsReminder(s.id);
}

async function getSubjectsSessions(userId, status) {
  const s = await _getStudent(userId);
  return repo.getSubjectsSessions(s.id, _validStatus(status));
}

async function getSubjectsSessionById(userId, sessionId) {
  const s = await _getStudent(userId);
  const session = await repo.getSubjectsSessionById(s.id, Number(sessionId));
  if (!session) throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" });
  return session;
}

async function getActivitiesReminder(userId) {
  const s = await _getStudent(userId);
  return repo.getActivitiesReminder(s.id);
}

async function getActivitiesSessions(userId, status) {
  const s = await _getStudent(userId);
  return repo.getActivitiesSessions(s.id, _validStatus(status));
}

async function getActivitiesSessionById(userId, sessionId) {
  const s = await _getStudent(userId);
  const session = await repo.getActivitiesSessionById(s.id, Number(sessionId));
  if (!session) throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" });
  return session;
}

async function getSubjectsWithSessions(userId) {
  const s = await _getStudent(userId);
  return repo.getSubjectsWithSessions(s.id);
}

async function getActivitiesWithSessions(userId) {
  const s = await _getStudent(userId);
  return repo.getActivitiesWithSessions(s.id);
}

async function getAvailableSubjects(userId) {
  const s = await _getStudent(userId);
  return subjectAddon.getAvailableSubjects(s.id);
}

async function initiateSubjectAddon(userId, activityId, termMonths) {
  const s = await _getStudent(userId);
  return subjectAddon.initiateAddon(s.id, userId, Number(activityId), Number(termMonths));
}

async function getSubjectAddonStatus(tempUuid) {
  return subjectAddon.getAddonStatus(tempUuid);
}

async function submitFeedback(userId, sessionId, rating, comment) {
  const s = await _getStudent(userId);
  if (!rating || rating < 1 || rating > 5) throw Object.assign(new Error("rating must be 1–5"), { code: "INVALID" });
  return repo.submitFeedback(s.id, Number(sessionId), rating, comment);
}

module.exports = {
  getToggleState,
  getSubjectsDashboardStats, getActivitiesDashboardStats,
  getSubjectsReminder, getSubjectsSessions, getSubjectsSessionById,
  getActivitiesReminder, getActivitiesSessions, getActivitiesSessionById,
  getSubjectsWithSessions, getActivitiesWithSessions,
  getAvailableSubjects, initiateSubjectAddon, getSubjectAddonStatus,
  submitFeedback,
};
