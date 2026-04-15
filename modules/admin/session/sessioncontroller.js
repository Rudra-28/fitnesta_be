const service = require("./sessionservice");

const ERROR_MAP = {
  SESSION_NOT_FOUND:        404,
  STUDENT_NOT_FOUND:        404,
  PROFESSIONAL_NOT_FOUND:   404,
  PROFESSIONAL_CONFLICT:    409,
  STUDENT_CONFLICT:         409,
  SESSION_ALREADY_FINAL:    409,
  MANUAL_STATUS_NOT_ALLOWED: 403,
  INVALID_SESSION_TYPE:     400,
  MISSING_FIELDS:           400,
  NO_DAYS_IN_RANGE:         400,
  NO_PROFESSIONAL:          400,
  NO_MEMBERSHIP:            400,
  NO_SESSION_CONFIG:        400,
  INVALID_DATE:             400,
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

/**
 * DELETE /api/v1/admin/sessions/:sessionId
 * Hard-delete a single session. Blocks deletion of completed sessions.
 */
async function deleteSession(req, res) {
  try {
    await service.deleteSession(req.params.sessionId);
    return res.json({ success: true, message: "Session deleted successfully" });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * DELETE /api/v1/admin/sessions/bulk-future
 * Bulk-delete all upcoming (scheduled) sessions for a student.
 * Body: { student_id, session_type, from_date? }
 */
async function bulkDeleteFutureSessions(req, res) {
  try {
    const { student_id, session_type, from_date } = req.body;
    if (!student_id || !session_type) {
      return res.status(400).json({ success: false, message: "student_id and session_type are required" });
    }
    const result = await service.bulkDeleteFutureSessions({ student_id, session_type, from_date });
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function reassignSingleSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { new_professional_id } = req.body;
    if (!new_professional_id) {
      return res.status(400).json({ success: false, message: "new_professional_id is required" });
    }
    const result = await service.reassignSingleSession(sessionId, new_professional_id);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function reassignAllFutureSessions(req, res) {
  try {
    const { session_type, student_id, new_professional_id } = req.body;
    const result = await service.reassignAllFutureSessions({ session_type, student_id, new_professional_id });
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
  deleteSession,
  bulkDeleteFutureSessions,
  reassignSingleSession,
  reassignAllFutureSessions,
};
