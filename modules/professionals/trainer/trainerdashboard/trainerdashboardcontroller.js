const service = require("./trainerdashboardservice");

async function getSessions(req, res) {
  try {
    const status = req.query.status ?? "upcoming";
    const sessions = await service.getSessions(req.trainer.userId, status);
    return res.json({ success: true, data: sessions });
  } catch (err) {
    const code = { NOT_FOUND: 404, BAD_REQUEST: 400 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function getTrainerBatches(req, res) {
  try {
    const batches = await service.getTrainerBatches(req.trainer.userId);
    return res.json({ success: true, data: batches });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function getBatchesByLocation(req, res) {
  try {
    const data = await service.getBatchesByLocation(req.trainer.userId, req.query.location);
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    const code = { NOT_FOUND: 404, BAD_REQUEST: 400 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function getActivities(req, res) {
  try {
    const data = await service.getActivities(req.trainer.userId);
    return res.json({ success: true, total_activities: data.length, data });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function getBatchStudents(req, res) {
  try {
    const data = await service.getBatchStudents(req.trainer.userId, Number(req.params.batchId));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function getSessionById(req, res) {
  try {
    const data = await service.getSessionById(req.trainer.userId, Number(req.params.sessionId));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function punchIn(req, res) {
  try {
    const session = await service.punchIn(req.trainer.userId, Number(req.params.sessionId));
    return res.json({ success: true, data: session });
  } catch (err) {
    const code = { NOT_FOUND: 404, SESSION_NOT_FOUND: 404, INVALID_STATUS: 409 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function punchOut(req, res) {
  try {
    const session = await service.punchOut(req.trainer.userId, Number(req.params.sessionId));
    return res.json({ success: true, data: session });
  } catch (err) {
    const code = { NOT_FOUND: 404, SESSION_NOT_FOUND: 404, INVALID_STATUS: 409 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function getAllStudents(req, res) {
  try {
    const data = await service.getAllStudents(req.trainer.userId);
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function getStudentSessions(req, res) {
  try {
    const data = await service.getStudentSessions(req.trainer.userId, Number(req.params.studentId), req.query.status);
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    const code = { NOT_FOUND: 404, BAD_REQUEST: 400 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function getWalletSummary(req, res) {
  try {
    const data = await service.getWalletSummary(req.trainer.userId);
    return res.json({ success: true, data });
  } catch (err) {
    const code = { NOT_FOUND: 404, BAD_REQUEST: 400 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function getWalletBreakdown(req, res) {
  try {
    const status = req.params.status;
    const data = await service.getWalletBreakdown(req.trainer.userId, status);
    return res.json({ success: true, data });
  } catch (err) {
    const code = { NOT_FOUND: 404, BAD_REQUEST: 400 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function requestWithdrawal(req, res) {
  try {
    const data = await service.requestWithdrawal(req.trainer.userId);
    return res.json({ success: true, message: "Withdrawal initiated via Razorpay", data });
  } catch (err) {
    const code = err.statusCode || { NOT_FOUND: 404 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function saveUpiId(req, res) {
  try {
    await service.saveUpiId(req.trainer.userId, req.body.upi_id);
    return res.json({ success: true, message: "UPI ID saved successfully" });
  } catch (err) {
    const code = err.statusCode || { NOT_FOUND: 404 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

async function getBatchSessions(req, res) {
  try {
    const data = await service.getBatchSessions(req.trainer.userId, Number(req.params.batchId), req.query.status);
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    const code = { NOT_FOUND: 404, BAD_REQUEST: 400 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

module.exports = { getSessions, getSessionById, getTrainerBatches, getBatchesByLocation, getActivities, getBatchStudents, getBatchSessions, getAllStudents, getStudentSessions, punchIn, punchOut, getWalletSummary, getWalletBreakdown, requestWithdrawal, saveUpiId };
