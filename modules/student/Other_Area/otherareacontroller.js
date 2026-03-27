const service = require("./otherareaservice");
const { validateOtherArea } = require("./otherareavalidate");

const handleErr = (err, res) => {
    const status = err.statusCode
        || (err.message === "PENDING_NOT_FOUND" ? 404 : err.message === "ALREADY_REVIEWED" ? 409 : 500);
    res.status(status).json({ success: false, message: err.message });
};

// ── Public ─────────────────────────────────────────────────────────────────

exports.registerOtherArea = async (req, res) => {
    try {
        const data = { ...req.body };

        if (req.files?.activityAgreementPdf?.[0]) {
            data.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
        }

        data.hasSignedAgreement = data.hasSignedAgreement === 'true' || data.hasSignedAgreement === true;

        const errors = validateOtherArea(data);
        if (errors.length > 0)
            return res.status(400).json({ success: false, errors });

        const result = await service.registerOtherArea(data);
        return res.status(201).json(result);

    } catch (err) {
        console.error("Other Area Registration Error:", err);
        handleErr(err, res);
    }
};

// ── Admin: other_area_request ──────────────────────────────────────────────

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

// ── Admin: other_area_enrollment ───────────────────────────────────────────

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

// ── ME: other_area_enrollment ──────────────────────────────────────────────

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
