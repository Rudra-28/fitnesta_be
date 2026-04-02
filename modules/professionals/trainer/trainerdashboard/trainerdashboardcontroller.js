const service = require("./trainerdashboardservice");

async function getUpcomingSessions(req, res) {
  try {
    const sessions = await service.getUpcomingSessions(req.trainer.userId);
    return res.json({ success: true, data: sessions });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function getSessionHistory(req, res) {
  try {
    const sessions = await service.getSessionHistory(req.trainer.userId);
    return res.json({ success: true, data: sessions });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
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

module.exports = { getUpcomingSessions, getSessionHistory, getTrainerBatches };
