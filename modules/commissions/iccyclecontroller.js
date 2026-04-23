"use strict";

const service = require("./iccycleservice");
const log     = require("../../utils/logger");

/**
 * GET /api/v1/admin/trainers/:professionalId/ic-settlement
 * Returns IC settlement data structured as:
 *   { students: [ { student_id, name, activity_name, cycles: [...] } ] }
 */
exports.getICSettlement = async (req, res) => {
    try {
        const professionalId = parseInt(req.params.professionalId);
        if (isNaN(professionalId)) return res.status(400).json({ success: false, error: "Invalid professionalId" });
        const data = await service.getICSettlement(professionalId);
        return res.status(200).json(data);
    } catch (err) {
        log.error("[ic-cycle] getICSettlement failed", err);
        return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/v1/admin/ic-cycles/:cycleId/settle
 * Body: { professional_id }
 * Marks a single pending IC cycle as settled and writes commission + wallet entries.
 */
exports.settleCycle = async (req, res) => {
    try {
        const cycleId        = parseInt(req.params.cycleId);
        const professionalId = parseInt(req.body.professional_id);
        if (isNaN(cycleId) || isNaN(professionalId)) {
            return res.status(400).json({ success: false, error: "cycleId and professional_id are required" });
        }
        const result = await service.settleCycle(cycleId, professionalId);
        return res.status(200).json(result);
    } catch (err) {
        log.error("[ic-cycle] settleCycle failed", { cycleId: req.params.cycleId, error: err.message });
        return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};
