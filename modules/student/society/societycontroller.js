const service = require("./societyservice");
const { validateSociety } = require("./validatesociety");
const adminRepo = require("../../admin/adminrepository");

const handleErr = (err, res) => {
    const status = err.statusCode
        || (err.message === "PENDING_NOT_FOUND" ? 404 : err.message === "ALREADY_REVIEWED" ? 409 : 500);
    res.status(status).json({ success: false, message: err.message });
};

exports.registerSociety = async (req, res) => {
    try {
        const errors = validateSociety(req.body);
        if (errors.length > 0)
            return res.status(400).json({ success: false, errors });

        const result = await service.registerSociety(req.body);
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

// ── Admin ──────────────────────────────────────────────────────────────────

exports.listPendingRequests = async (_req, res) => {
    try {
        const data = await service.listPendingRequests();
        res.json({ success: true, count: data.length, data });
    } catch (err) { handleErr(err, res); }
};

exports.assignMeToRequest = async (req, res) => {
    try {
        const { me_professional_id } = req.body;
        if (!me_professional_id)
            return res.status(400).json({ success: false, message: "me_professional_id is required" });

        const result = await service.assignMeToRequest(Number(req.params.id), Number(me_professional_id));
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

exports.approveRequest = async (req, res) => {
    try {
        const result = await service.approveRequestByAdmin(Number(req.params.id), req.admin.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

exports.rejectRequest = async (req, res) => {
    try {
        const result = await service.rejectRequestByAdmin(Number(req.params.id), req.admin.userId, req.body?.note);
        res.json({ success: true, ...result });
    } catch (err) { handleErr(err, res); }
};

exports.listMEs = async (_req, res) => {
    try {
        const all = await adminRepo.getApprovedProfessionals("marketing_executive");
        const data = all.map((p) => ({
            professional_id: p.id,
            name: p.users?.full_name ?? null,
            mobile: p.users?.mobile ?? null,
            referral_code: p.referral_code ?? null,
        }));
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
