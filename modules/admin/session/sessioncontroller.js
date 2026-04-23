const service = require("./sessionservice");
const log = require("../../../utils/logger");

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
    log.info("[session] createSession", { session_type: req.body?.session_type, student_id: req.body?.student_id, professional_id: req.body?.professional_id });
    const session = await service.createIndividualSession(req.body);
    log.info("[session] createSession — created", { sessionId: session?.id });
    return res.status(201).json({ success: true, data: session });
  } catch (err) {
    log.error("[session] createSession — failed", err);
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
    log.info("[session] updateSessionStatus", { sessionId: req.params.sessionId, status, cancel_reason });
    const session = await service.updateSessionStatus(req.params.sessionId, status, cancel_reason);
    log.info("[session] updateSessionStatus — done", { sessionId: req.params.sessionId, newStatus: status });
    return res.json({ success: true, data: session });
  } catch (err) {
    log.error("[session] updateSessionStatus — failed", err);
    return handleError(res, err);
  }
}

async function cancelSession(req, res) {
  try {
    const { cancel_reason } = req.body;
    if (!cancel_reason) return res.status(400).json({ success: false, message: "cancel_reason is required" });
    log.info("[session] cancelSession", { sessionId: req.params.sessionId, cancel_reason });
    const session = await service.cancelSession(req.params.sessionId, cancel_reason);
    log.info("[session] cancelSession — cancelled", { sessionId: req.params.sessionId });
    return res.json({ success: true, data: session });
  } catch (err) {
    log.error("[session] cancelSession — failed", err);
    return handleError(res, err);
  }
}

async function generateIndividualSessions(req, res) {
  try {
    log.info("[session] generateIndividualSessions", { student_id: req.body?.student_id, session_type: req.body?.session_type, start_date: req.body?.start_date });
    const result = await service.generateIndividualSessions(req.body);
    log.info("[session] generateIndividualSessions — done", { count: result?.sessions?.length ?? result?.count ?? "?" });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    log.error("[session] generateIndividualSessions — failed", err);
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
    log.info("[session] rescheduleSession", { sessionId: req.params.sessionId, scheduled_date, start_time, end_time });
    const session = await service.rescheduleSession(req.params.sessionId, { scheduled_date, start_time, end_time });
    log.info("[session] rescheduleSession — rescheduled", { sessionId: req.params.sessionId, scheduled_date });
    return res.json({ success: true, data: session });
  } catch (err) {
    log.error("[session] rescheduleSession — failed", err);
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
    log.info("[session] deleteSession", { sessionId: req.params.sessionId });
    await service.deleteSession(req.params.sessionId);
    log.info("[session] deleteSession — deleted", { sessionId: req.params.sessionId });
    return res.json({ success: true, message: "Session deleted successfully" });
  } catch (err) {
    log.error("[session] deleteSession — failed", err);
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
    log.info("[session] bulkDeleteFutureSessions", { student_id, session_type, from_date });
    const result = await service.bulkDeleteFutureSessions({ student_id, session_type, from_date });
    log.info("[session] bulkDeleteFutureSessions — deleted", { student_id, session_type, deleted_count: result?.count ?? "?" });
    return res.json({ success: true, data: result });
  } catch (err) {
    log.error("[session] bulkDeleteFutureSessions — failed", err);
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
    log.info("[session] reassignSingleSession", { sessionId, new_professional_id });
    const result = await service.reassignSingleSession(sessionId, new_professional_id);
    log.info("[session] reassignSingleSession — done", { sessionId, new_professional_id });
    return res.json({ success: true, data: result });
  } catch (err) {
    log.error("[session] reassignSingleSession — failed", err);
    return handleError(res, err);
  }
}

async function reassignAllFutureSessions(req, res) {
  try {
    const { session_type, student_id, new_professional_id } = req.body;
    log.info("[session] reassignAllFutureSessions", { session_type, student_id, new_professional_id });
    const result = await service.reassignAllFutureSessions({ session_type, student_id, new_professional_id });
    log.info("[session] reassignAllFutureSessions — done", { session_type, student_id, new_professional_id, count: result?.count ?? "?" });
    return res.json({ success: true, data: result });
  } catch (err) {
    log.error("[session] reassignAllFutureSessions — failed", err);
    return handleError(res, err);
  }
}

async function addSessionToCycle(req, res) {
  try {
    log.info("[session] addSessionToCycle", { student_id: req.body?.student_id, session_type: req.body?.session_type });
    const result = await service.addSessionToCycle(req.body);
    log.info("[session] addSessionToCycle — added", { sessionId: result?.id });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    log.error("[session] addSessionToCycle — failed", err);
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
  addSessionToCycle,
};
