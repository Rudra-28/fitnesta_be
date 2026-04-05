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

async function getTransactionHistory(req, res) {
  try {
    const { status, source_type, page, limit } = req.query;
    const data = await service.getTransactionHistory(req.trainer.userId, {
      status, source_type,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 20,
    });
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

async function withdrawRequest(req, res) {
  try {
    const data = await service.withdrawRequest(req.trainer.userId);
    return res.json({ success: true, message: "Withdrawal request submitted", data });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }
}

async function withdrawNow(req, res) {
  try {
    const data = await service.withdrawNow(req.trainer.userId);
    return res.json({ success: true, message: "Transfer initiated via Razorpay", data });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }
}

async function savePayoutDetails(req, res) {
  try {
    await service.savePayoutDetails(req.trainer.userId, req.body);
    return res.json({ success: true, message: "Payout details saved successfully" });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
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

async function getSportsActivities(req, res) {
  try {
    const data = await service.getSportsActivities(req.trainer.userId);
    return res.json({ success: true, total: data.length, data });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function getSessionsByActivity(req, res) {
  try {
    const { activity_id, activity_name, status } = req.query;
    const data = await service.getSessionsByActivity(req.trainer.userId, activity_id, activity_name, status);
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    const code = { NOT_FOUND: 404, BAD_REQUEST: 400 }[err.code] || 500;
    return res.status(code).json({ success: false, message: err.message });
  }
}

module.exports = { getSessions, getSessionById, getTrainerBatches, getBatchesByLocation, getActivities, getBatchStudents, getBatchSessions, getAllStudents, getStudentSessions, punchIn, punchOut, getWalletSummary, getWalletBreakdown, getTransactionHistory, withdrawRequest, withdrawNow, savePayoutDetails, getSportsActivities, getSessionsByActivity };
