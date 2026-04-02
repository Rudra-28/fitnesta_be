const service = require("./teacherdashboardservice");

// GET /teacher-dashboard/summary
exports.getSummary = async (req, res) => {
    try {
        const result = await service.getSummary(req.teacher.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/students?standard=5TH-6TH
// standard is optional; omit or pass ALL to get every student grouped by standard
exports.getStudents = async (req, res) => {
    try {
        const standard = req.query.standard ?? "ALL";
        const result = await service.getStudents(req.teacher.id, standard);
        res.json(result);
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/sessions
exports.getUpcomingSessions = async (req, res) => {
    try {
        const result = await service.getUpcomingSessions(req.teacher.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/sessions/history
exports.getSessionHistory = async (req, res) => {
    try {
        const result = await service.getSessionHistory(req.teacher.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
