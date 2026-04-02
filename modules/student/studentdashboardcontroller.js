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

module.exports = { getUpcomingSessions, getSessionHistory };
