const service = require("./sessionservice");

const ERROR_MAP = {
  SESSION_NOT_FOUND: 404,
  STUDENT_NOT_FOUND: 404,
  PROFESSIONAL_NOT_FOUND: 404,
  PROFESSIONAL_CONFLICT: 409,
  STUDENT_CONFLICT: 409,
  SESSION_ALREADY_FINAL: 409,
  INVALID_SESSION_TYPE: 400,
  MISSING_FIELDS: 400,
};

function handleError(res, err) {
  const status = ERROR_MAP[err.code] || 500;
  return res.status(status).json({ success: false, message: err.message, code: err.code });
}

async function createSession(req, res) {
  try {
    const session = await service.createIndividualSession(req.body);
    return res.status(201).json({ success: true, data: session });
  } catch (err) {
    return handleError(res, err);
  }
}

async function listSessions(req, res) {
  try {
    const { student_id, professional_id, from, to, status, session_type } = req.query;
    const sessions = await service.listSessions({ student_id, professional_id, from, to, status, session_type });
    return res.json({ success: true, data: sessions });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getSession(req, res) {
  try {
    const session = await service.getSession(req.params.sessionId);
    return res.json({ success: true, data: session });
  } catch (err) {
    return handleError(res, err);
  }
}

async function updateSessionStatus(req, res) {
  try {
    const { status, cancel_reason } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });
    const session = await service.updateSessionStatus(req.params.sessionId, status, cancel_reason);
    return res.json({ success: true, data: session });
  } catch (err) {
    return handleError(res, err);
  }
}

async function cancelSession(req, res) {
  try {
    const { cancel_reason } = req.body;
    if (!cancel_reason) return res.status(400).json({ success: false, message: "cancel_reason is required" });
    const session = await service.cancelSession(req.params.sessionId, cancel_reason);
    return res.json({ success: true, data: session });
  } catch (err) {
    return handleError(res, err);
  }
}

async function generateIndividualSessions(req, res) {
  try {
    const result = await service.generateIndividualSessions(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function extendMembership(req, res) {
  try {
    const result = await service.extendMembership(req.body);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function rescheduleSession(req, res) {
  try {
    const { scheduled_date, start_time, end_time } = req.body;
    const session = await service.rescheduleSession(req.params.sessionId, { scheduled_date, start_time, end_time });
    return res.json({ success: true, data: session });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getStudentSessionBatches(req, res) {
  try {
    const batches = await service.getStudentSessionBatches(req.params.studentId);
    return res.json({ success: true, data: batches });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getSessionFeedback(req, res) {
  try {
    const feedback = await service.getSessionFeedback(req.params.sessionId);
    return res.json({ success: true, data: feedback });
  } catch (err) {
    return handleError(res, err);
  }
}

async function previewSessionGeneration(req, res) {
  try {
    const { session_type, student_id, start_date, days_of_week } = req.query;
    const parsedDays = days_of_week
      ? (Array.isArray(days_of_week) ? days_of_week : days_of_week.split(","))
      : [];
    const result = await service.previewSessionGeneration({ session_type, student_id, start_date, days_of_week: parsedDays });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  createSession,
  generateIndividualSessions,
  extendMembership,
  listSessions,
  getSession,
  updateSessionStatus,
  cancelSession,
  rescheduleSession,
  getStudentSessionBatches,
  getSessionFeedback,
  previewSessionGeneration,
};
