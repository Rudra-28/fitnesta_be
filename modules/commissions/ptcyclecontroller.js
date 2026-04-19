"use strict";

const service = require("./ptcycleservice");

/**
 * GET /api/v1/admin/teachers/:professionalId/pt-settlement
 * Returns settlement data for a teacher structured as:
 *   { students: [ { student_id, name, activities: [ { activity_id, activity_name, cycles: [...] } ] } ] }
 */
exports.getPTSettlement = async (req, res) => {
    try {
        const professionalId = parseInt(req.params.professionalId);
        if (isNaN(professionalId)) return res.status(400).json({ success: false, error: "Invalid professionalId" });
        const data = await service.getPTSettlement(professionalId);
        return res.status(200).json(data);
    } catch (err) {
        console.error("[PTCycle] getPTSettlement error:", err.message);
        return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/v1/admin/pt-cycles/:cycleId/settle
 * Body: { professional_id }
 * Marks a single pending cycle as settled and writes commission + wallet entries.
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
        console.error("[PTCycle] settleCycle error:", err.message);
        return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};
