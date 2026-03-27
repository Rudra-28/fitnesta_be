const service = require("./societyservice");
const { validateSociety } = require("./validatesociety");

exports.registerSociety = async (req, res) => {
    try {
        const data = { ...req.body };

        // Merge uploaded agreement PDF path if provided
        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }

        // Normalize booleans from multipart/form-data strings
        data.playgroundAvailable = data.playgroundAvailable === 'true' || data.playgroundAvailable === true;
        data.hasSignedAgreement  = data.hasSignedAgreement  === 'true' || data.hasSignedAgreement  === true;

        const errors = validateSociety(data);
        if (errors.length > 0)
            return res.status(400).json({ success: false, errors });

        const result = await service.registerSociety(data);
        return res.status(201).json(result);

    } catch (error) {
        console.error("Society Registration Error:", error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to register society"
        });
    }
};

exports.getSocieties = async (_req, res) => {
    try {
        const societies = await service.getSocieties();
        res.json({ success: true, data: societies });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch societies" });
    }
};

// ── shared error handler ───────────────────────────────────────────────────
const handleErr = (err, res) => {
    const status = err.statusCode
        || (err.message === "PENDING_NOT_FOUND" ? 404 : err.message === "ALREADY_REVIEWED" ? 409 : 500);
    res.status(status).json({ success: false, message: err.message });
};

// ── Admin: society_request ─────────────────────────────────────────────────

exports.listPendingRequests = async (_req, res) => {
    try {
        const data = await service.listPendingRequests();
        res.json({ success: true, count: data.length, data });
    } catch (err) { handleErr(err, res); }
};

exports.approveRequest = async (req, res) => {
    try {
        const result = await service.approveRequestByAdmin(req.params.id, req.admin.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

exports.rejectRequest = async (req, res) => {
    try {
        const result = await service.rejectRequestByAdmin(req.params.id, req.admin.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

// ── Admin: society_enrollment ──────────────────────────────────────────────

exports.listPendingEnrollments = async (_req, res) => {
    try {
        const data = await service.listPendingEnrollments();
        res.json({ success: true, count: data.length, data });
    } catch (err) { handleErr(err, res); }
};

exports.approveEnrollmentByAdmin = async (req, res) => {
    try {
        const result = await service.approveEnrollmentByAdmin(req.params.id, req.admin.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

exports.rejectEnrollmentByAdmin = async (req, res) => {
    try {
        const result = await service.rejectEnrollmentByAdmin(req.params.id, req.admin.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

// ── ME: society_enrollment ─────────────────────────────────────────────────

exports.listPendingEnrollmentsForMe = async (req, res) => {
    try {
        const data = await service.listPendingEnrollmentsForMe(req.me.userId);
        res.json({ success: true, count: data.length, data });
    } catch (err) { handleErr(err, res); }
};

exports.approveEnrollmentByMe = async (req, res) => {
    try {
        const result = await service.approveEnrollmentByMe(req.params.id, req.me.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

exports.rejectEnrollmentByMe = async (req, res) => {
    try {
        const result = await service.rejectEnrollmentByMe(req.params.id, req.me.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};
