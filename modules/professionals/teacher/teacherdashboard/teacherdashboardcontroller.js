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

// GET /teacher-dashboard/sessions/:id
exports.getSessionById = async (req, res) => {
    try {
        const result = await service.getSessionById(req.teacher.id, Number(req.params.id));
        res.json(result);
    } catch (err) {
        res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/subjects
exports.getSubjects = async (req, res) => {
    try {
        const result = await service.getSubjects(req.teacher.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/students/:tutorRecordId
exports.getStudentDetail = async (req, res) => {
    try {
        const result = await service.getStudentDetail(req.teacher.id, Number(req.params.tutorRecordId));
        res.json(result);
    } catch (err) {
        res.status(err.code === "NOT_FOUND" ? 404 : 500).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/sessions?status=upcoming|ongoing|history
exports.getSessions = async (req, res) => {
    try {
        const result = await service.getSessions(req.teacher.id, req.query.status ?? "upcoming");
        res.json(result);
    } catch (err) {
        res.status(err.code === "BAD_REQUEST" ? 400 : 500).json({ success: false, error: err.message });
    }
};

// POST /teacher-dashboard/sessions/:id/start
exports.startSession = async (req, res) => {
    try {
        const result = await service.startSession(req.teacher.id, req.params.id);
        res.json(result);
    } catch (err) {
        const status = err.code === "FORBIDDEN" ? 403 : err.code === "NOT_FOUND" ? 404 : 409;
        res.status(status).json({ success: false, error: err.message });
    }
};

// POST /teacher-dashboard/sessions/:id/end
exports.endSession = async (req, res) => {
    try {
        const result = await service.endSession(req.teacher.id, req.params.id);
        res.json(result);
    } catch (err) {
        const status = err.code === "FORBIDDEN" ? 403 : err.code === "NOT_FOUND" ? 404 : 409;
        res.status(status).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/wallet
exports.getWalletSummary = async (req, res) => {
    try {
        const data = await service.getWalletSummary(req.teacher.id);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// GET /teacher-dashboard/wallet/:status  (pending|approved|requested|paid)
exports.getWalletBreakdown = async (req, res) => {
    try {
        const data = await service.getWalletBreakdown(req.teacher.id, req.params.status);
        res.json({ success: true, data });
    } catch (err) {
        const code = err.statusCode || (err.code === "NOT_FOUND" ? 404 : 500);
        res.status(code).json({ success: false, error: err.message });
    }
};

// POST /teacher-dashboard/wallet/withdraw
exports.requestWithdrawal = async (req, res) => {
    try {
        const data = await service.requestWithdrawal(req.teacher.id);
        res.json({ success: true, message: "Withdrawal initiated via Razorpay", data });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};

// PUT /teacher-dashboard/wallet/upi
exports.saveUpiId = async (req, res) => {
    try {
        await service.saveUpiId(req.teacher.id, req.body.upi_id);
        res.json({ success: true, message: "UPI ID saved successfully" });
    } catch (err) {
        res.status(err.statusCode || 500).json({ success: false, message: err.message });
    }
};
