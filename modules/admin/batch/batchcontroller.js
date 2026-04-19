const service = require("./batchservice");

const ERROR_MAP = {
  BATCH_NOT_FOUND: 404,
  BATCH_INACTIVE: 409,
  SOCIETY_OR_SCHOOL_REQUIRED: 400,
  DATE_RANGE_INVALID: 400,
  NO_DAYS_IN_RANGE: 400,
  PROFESSIONAL_NOT_FOUND: 404,
  PROFESSIONAL_CONFLICT: 409,
  STUDENT_NOT_FOUND: 404,
  INVALID_BATCH_TYPE: 400,
  ACTIVITY_NOT_FOUND: 404,
  NO_CYCLE: 400,
  CYCLE_INCOMPLETE: 423,
  ALREADY_SETTLED: 409,
  NOT_FOUND: 404,
  INVALID_STATUS: 409,
  SESSION_CAP_LOCKED: 409,
  INVALID_PROFESSIONAL_TYPE: 400,
  MISSING_FIELDS: 400,
  DATE_OUTSIDE_CYCLE: 422,
};

function handleError(res, err) {
  const status = ERROR_MAP[err.code] || 500;
  if (status === 500) console.error('[BatchController]', err);
  return res.status(status).json({ success: false, message: err.message, code: err.code });
}

async function createBatch(req, res) {
  try {
    const batch = await service.createBatch(req.body);
    return res.status(201).json({ success: true, data: batch });
  } catch (err) {
    return handleError(res, err);
  }
}

async function listBatches(req, res) {
  try {
    const { batch_type, society_id, school_id, activity_id } = req.query;
    const batches = await service.listBatches({ batch_type, society_id, school_id, activity_id });
    return res.json({ success: true, data: batches });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getBatch(req, res) {
  try {
    const batch = await service.getBatch(req.params.batchId);
    return res.json({ success: true, data: batch });
  } catch (err) {
    return handleError(res, err);
  }
}

async function updateBatch(req, res) {
  try {
    const batch = await service.updateBatch(req.params.batchId, req.body);
    return res.json({ success: true, data: batch });
  } catch (err) {
    return handleError(res, err);
  }
}

async function deleteBatch(req, res) {
  try {
    const result = await service.deleteBatch(req.params.batchId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function generateSessions(req, res) {
  try {
    const { session_cap_override, start_date_override } = req.body ?? {};
    const result = await service.generateSessions(req.params.batchId, { session_cap_override, start_date_override });
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function bulkAssignStudents(req, res) {
  try {
    const { student_ids } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, message: "student_ids must be a non-empty array" });
    }
    const result = await service.bulkAssignStudents(req.params.batchId, student_ids);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function removeBatchStudent(req, res) {
  try {
    const result = await service.removeBatchStudent(req.params.batchId, req.params.studentId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getUnassignedGroupStudents(req, res) {
  try {
    const { society_id, activity_id } = req.query;
    if (!society_id) return res.status(400).json({ success: false, message: "society_id is required" });
    const data = await service.getUnassignedGroupStudents(society_id, activity_id);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getBatchDetail(req, res) {
  try {
    const data = await service.getBatchDetail(req.params.batchId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getSettlementPreview(req, res) {
  try {
    const data = await service.getSettlementPreview(req.params.batchId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

async function settleBatchCycle(req, res) {
  try {
    const cycleId = parseInt(req.params.cycleId);
    if (isNaN(cycleId)) return res.status(400).json({ success: false, error: "cycleId is required" });
    const result = await service.settleBatchCycle(cycleId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function markSettlementPaid(req, res) {
  try {
    const result = await service.markSettlementPaid(req.params.settlementId);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function listSettlements(req, res) {
  try {
    const data = await service.listSettlements(req.params.batchId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
}

async function reassignBatchSession(req, res) {
  try {
    const { batchId, sessionId } = req.params;
    const { new_professional_id } = req.body;
    if (!new_professional_id) {
      return res.status(400).json({ success: false, message: 'new_professional_id is required' });
    }
    const result = await service.reassignBatchSession(Number(batchId), Number(sessionId), Number(new_professional_id));
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function reassignAllFutureBatchSessions(req, res) {
  try {
    const { batchId } = req.params;
    const { new_professional_id } = req.body;
    if (!new_professional_id) {
      return res.status(400).json({ success: false, message: 'new_professional_id is required' });
    }
    const result = await service.reassignAllFutureBatchSessions(Number(batchId), Number(new_professional_id));
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function extendStudentTerm(req, res) {
  try {
    const { batchId, studentId } = req.params;
    const { extra_months } = req.body;
    if (!extra_months) {
      return res.status(400).json({ success: false, message: 'extra_months is required' });
    }
    const result = await service.extendStudentTerm(batchId, studentId, extra_months);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function createBatchSession(req, res) {
  try {
    const { batchId } = req.params;
    const result = await service.createBatchSession(batchId, req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function deleteBatchSession(req, res) {
  try {
    const { batchId, sessionId } = req.params;
    const result = await service.deleteBatchSession(Number(batchId), Number(sessionId));
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function bulkDeleteBatchSessions(req, res) {
  try {
    const { batchId } = req.params;
    const { from_date } = req.body;
    const result = await service.bulkDeleteBatchSessions(Number(batchId), from_date);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

async function getAvailableProfessionalsForBatch(req, res) {
  try {
    const { batchId } = req.params;
    const { type } = req.query;
    const result = await service.getAvailableProfessionalsForBatch(batchId || null, type);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  createBatch,
  listBatches,
  getBatch,
  updateBatch,
  deleteBatch,
  generateSessions,
  bulkAssignStudents,
  removeBatchStudent,
  getBatchDetail,
  getUnassignedGroupStudents,
  getSettlementPreview,
  settleBatchCycle,
  markSettlementPaid,
  listSettlements,
  reassignBatchSession,
  reassignAllFutureBatchSessions,
  extendStudentTerm,
  createBatchSession,
  getAvailableProfessionalsForBatch,
  deleteBatchSession,
  bulkDeleteBatchSessions,
};
