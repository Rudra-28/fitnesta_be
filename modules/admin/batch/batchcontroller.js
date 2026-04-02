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
    const { start_date, end_date } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: "start_date and end_date are required" });
    }
    const result = await service.generateSessions(req.params.batchId, start_date, end_date);
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

module.exports = {
  createBatch,
  listBatches,
  getBatch,
  updateBatch,
  deleteBatch,
  generateSessions,
  bulkAssignStudents,
  removeBatchStudent,
};
