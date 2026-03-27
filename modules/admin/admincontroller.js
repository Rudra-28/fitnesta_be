const service = require("./adminservice");

exports.listPending = async (req, res) => {
    try {
        const { type } = req.query; // optional: ?type=trainer
        const data = await service.listPending(type);
        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error("List pending error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.approve = async (req, res) => {
    try {
        const result = await service.approveRegistration(
            req.params.id,
            req.admin.userId,
            req.body?.note
        );
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("Approve error:", err.message);
        const status = err.message === "PENDING_NOT_FOUND" ? 404
                     : err.message === "ALREADY_REVIEWED"  ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};

exports.reject = async (req, res) => {
    try {
        const result = await service.rejectRegistration(
            req.params.id,
            req.admin.userId,
            req.body?.note
        );
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("Reject error:", err.message);
        const status = err.message === "PENDING_NOT_FOUND" ? 404
                     : err.message === "ALREADY_REVIEWED"  ? 409
                     : 500;
        res.status(status).json({ success: false, error: err.message });
    }
};
