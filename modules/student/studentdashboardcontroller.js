const service = require("./studentdashboardservice");

async function getUpcomingSessions(req, res) {
  try {
    const data = await service.getUpcomingSessions(req.user.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function getSessionHistory(req, res) {
  try {
    const data = await service.getSessionHistory(req.user.userId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, message: err.message });
  }
}

async function submitFeedback(req, res) {
  try {
    const { rating, comment } = req.body;
    const data = await service.submitFeedback(req.user.userId, req.params.id, Number(rating), comment);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "INVALID" ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

module.exports = { getUpcomingSessions, getSessionHistory, submitFeedback };
