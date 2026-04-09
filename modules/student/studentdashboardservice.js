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

async function editProfile(userId, data) {
  const s = await _getStudent(userId);

  // ── users table fields (common to all types) ──────────────────────────────
  const userData = {};
  if (data.fullName       !== undefined) userData.full_name = data.fullName;
  if (data.contactNumber  !== undefined) userData.mobile    = data.contactNumber;
  if (data.address        !== undefined) userData.address   = data.address;

  // ── type-specific fields ──────────────────────────────────────────────────
  const typeData = {};

  if (s.student_type === "individual_coaching" || s.student_type === "group_coaching") {
    if (data.fullName       !== undefined) typeData.participant_name = data.fullName;
    if (data.contactNumber  !== undefined) typeData.mobile           = data.contactNumber;
    if (data.flatNo         !== undefined) typeData.flat_no          = data.flatNo;
    if (data.societyName    !== undefined) typeData.society_name     = data.societyName;
    if (data.kitType        !== undefined) typeData.kits             = data.kitType;
    if (data.preferredBatch !== undefined) typeData.preferred_batch  = data.preferredBatch;
    if (data.preferredTime  !== undefined) typeData.preferred_time   = data.preferredTime;

  } else if (s.student_type === "personal_tutor") {
    if (data.standard       !== undefined) typeData.standard       = data.standard;
    if (data.batch          !== undefined) typeData.batch          = data.batch;
    if (data.teacherFor     !== undefined) typeData.teacher_for    = data.teacherFor;
    if (data.preferredTime  !== undefined) typeData.preferred_time = data.preferredTime;

  } else if (s.student_type === "school_student") {
    if (data.fullName       !== undefined) typeData.student_name = data.fullName;
    if (data.standard       !== undefined) typeData.standard     = data.standard;
    if (data.address        !== undefined) typeData.address      = data.address;
  }

  await repo.editProfile(Number(userId), s.student_type, userData, typeData);
  return { success: true, message: "Profile updated successfully" };
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
  editProfile,
};
