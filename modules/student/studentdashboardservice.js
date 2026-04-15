const repo = require("./studentdashboardrepo");
const subjectAddon = require("./subjectaddon/subjectaddonservice");

async function _getStudent(userId) {
  const student = await repo.getStudentIdByUserId(userId);
  if (!student) throw Object.assign(new Error("Student profile not found"), { code: "NOT_FOUND" });
  return student;
}

function _validStatus(status) {
  const valid = ["upcoming", "ongoing", "completed", "absent", "cancelled"];
  return valid.includes(status) ? status : null;
}

function _formatTimeValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    const ss = String(value.getSeconds()).padStart(2, "0");
    return ss === "00" ? `${hh}:${mm}` : `${hh}:${mm}:${ss}`;
  }

  const raw = String(value).trim();
  const timeMatch = raw.match(/(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) return raw;

  const [, hh, mm, ss = "00"] = timeMatch;
  return ss === "00" ? `${hh}:${mm}` : `${hh}:${mm}:${ss}`;
}

function _normalizeSessionPayload(session) {
  if (!session || typeof session !== "object") return session;

  if (Array.isArray(session)) {
    return session.map(_normalizeSessionPayload);
  }

  const normalized = { ...session };
  if ("start_time" in normalized) normalized.start_time = _formatTimeValue(normalized.start_time);
  if ("end_time" in normalized) normalized.end_time = _formatTimeValue(normalized.end_time);

  if (normalized.sessions) {
    normalized.sessions = _normalizeSessionPayload(normalized.sessions);
  }
  if (normalized.session_feedback) {
    normalized.session_feedback = _normalizeSessionPayload(normalized.session_feedback);
  }

  return normalized;
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
  return _normalizeSessionPayload(await repo.getSubjectsReminder(s.id));
}

async function getSubjectsSessions(userId, status) {
  const s = await _getStudent(userId);
  return _normalizeSessionPayload(await repo.getSubjectsSessions(s.id, _validStatus(status)));
}

async function getSubjectsSessionById(userId, sessionId) {
  const s = await _getStudent(userId);
  const session = await repo.getSubjectsSessionById(s.id, Number(sessionId));
  if (!session) throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" });
  return _normalizeSessionPayload(session);
}

async function getActivitiesReminder(userId) {
  const s = await _getStudent(userId);
  return _normalizeSessionPayload(await repo.getActivitiesReminder(s.id));
}

async function getActivitiesSessions(userId, status) {
  const s = await _getStudent(userId);
  return _normalizeSessionPayload(await repo.getActivitiesSessions(s.id, _validStatus(status)));
}

async function getActivitiesSessionById(userId, sessionId) {
  const s = await _getStudent(userId);
  const session = await repo.getActivitiesSessionById(s.id, Number(sessionId));
  if (!session) throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" });
  return _normalizeSessionPayload(session);
}

async function getSubjectsWithSessions(userId) {
  const s = await _getStudent(userId);
  return _normalizeSessionPayload(await repo.getSubjectsWithSessions(s.id));
}

async function getActivitiesWithSessions(userId) {
  const s = await _getStudent(userId);
  return _normalizeSessionPayload(await repo.getActivitiesWithSessions(s.id));
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

async function markAttendance(userId, sessionId) {
  const s = await _getStudent(userId);

  const session = await repo.getSessionForAttendance(sessionId);
  if (!session) throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" });
  if (session.status === "cancelled") throw Object.assign(new Error("Session is cancelled"), { code: "BAD_REQUEST" });
  if (session.status === "absent") throw Object.assign(new Error("Session was marked absent"), { code: "BAD_REQUEST" });

  const now = new Date();
  const sessionDate = new Date(session.scheduled_date);
  const normalizedStartTime = _formatTimeValue(session.start_time);
  const [hours, minutes] = String(normalizedStartTime ?? "00:00").split(":").map(Number);

  const sessionStart = new Date(
    sessionDate.getFullYear(),
    sessionDate.getMonth(),
    sessionDate.getDate(),
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0
  );

  const diffInMins = (now - sessionStart) / (1000 * 60);

  if (diffInMins < 0) throw Object.assign(new Error("Session has not started yet"), { code: "BAD_REQUEST" });
  if (diffInMins > 10) throw Object.assign(new Error("Attendance window closed (10-minute limit exceeded)"), { code: "BAD_REQUEST" });

  await repo.updateStudentAttendance(sessionId, s.id);
  return { success: true, message: "Attendance marked successfully" };
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
  markAttendance,
};
