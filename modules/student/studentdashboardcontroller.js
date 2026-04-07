const service = require("./studentdashboardservice");

function errStatus(err) {
  return { NOT_FOUND: 404, INVALID: 400, BAD_REQUEST: 400 }[err.code] || 500;
}

function wrap(fn) {
  return async (req, res) => {
    try { return await fn(req, res); }
    catch (err) { return res.status(errStatus(err)).json({ success: false, message: err.message }); }
  };
}

module.exports = {
  getToggleState: wrap(async (req, res) => {
    const data = await service.getToggleState(req.user.userId);
    res.json({ success: true, data });
  }),
  getSubjectsDashboardStats: wrap(async (req, res) => {
    const data = await service.getSubjectsDashboardStats(req.user.userId);
    res.json({ success: true, data });
  }),
  getActivitiesDashboardStats: wrap(async (req, res) => {
    const data = await service.getActivitiesDashboardStats(req.user.userId);
    res.json({ success: true, data });
  }),
  getSubjectsReminder: wrap(async (req, res) => {
    const data = await service.getSubjectsReminder(req.user.userId);
    res.json({ success: true, count: data.length, data });
  }),
  getSubjectsSessions: wrap(async (req, res) => {
    const data = await service.getSubjectsSessions(req.user.userId, req.query.status);
    res.json({ success: true, count: data.length, data });
  }),
  getSubjectsSessionById: wrap(async (req, res) => {
    const data = await service.getSubjectsSessionById(req.user.userId, req.params.sessionId);
    res.json({ success: true, data });
  }),
  getActivitiesReminder: wrap(async (req, res) => {
    const data = await service.getActivitiesReminder(req.user.userId);
    res.json({ success: true, count: data.length, data });
  }),
  getActivitiesSessions: wrap(async (req, res) => {
    const data = await service.getActivitiesSessions(req.user.userId, req.query.status);
    res.json({ success: true, count: data.length, data });
  }),
  getActivitiesSessionById: wrap(async (req, res) => {
    const data = await service.getActivitiesSessionById(req.user.userId, req.params.sessionId);
    res.json({ success: true, data });
  }),
  getSubjectsWithSessions: wrap(async (req, res) => {
    const data = await service.getSubjectsWithSessions(req.user.userId);
    res.json({ success: true, count: data.length, data });
  }),
  getActivitiesWithSessions: wrap(async (req, res) => {
    const data = await service.getActivitiesWithSessions(req.user.userId);
    res.json({ success: true, count: data.length, data });
  }),
  submitFeedback: wrap(async (req, res) => {
    const data = await service.submitFeedback(req.user.userId, req.params.id, Number(req.body.rating), req.body.comment);
    res.status(201).json({ success: true, data });
  }),

  getAvailableSubjects: wrap(async (req, res) => {
    const data = await service.getAvailableSubjects(req.user.userId);
    res.json({ success: true, count: data.length, data });
  }),

  initiateSubjectAddon: wrap(async (req, res) => {
    const { activity_id, term_months } = req.body;
    if (!activity_id || !term_months) {
      return res.status(400).json({ success: false, message: "activity_id and term_months are required" });
    }
    const data = await service.initiateSubjectAddon(req.user.userId, activity_id, term_months);
    res.json({ success: true, ...data });
  }),

};
