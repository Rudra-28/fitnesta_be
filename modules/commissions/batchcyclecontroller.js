"use strict";

const service    = require("./batchcycleservice");
const batchSvc   = require("../admin/batch/batchservice");

/**
 * GET /api/v1/admin/trainers/:professionalId/society-settlement
 * Returns society → activity → batch → cycles breakdown for a trainer.
 */
exports.getSocietySettlement = async (req, res) => {
    try {
        const professionalId = parseInt(req.params.professionalId);
        if (isNaN(professionalId)) return res.status(400).json({ success: false, error: "Invalid professionalId" });
        const data = await service.getSocietySettlement(professionalId);
        return res.status(200).json(data);
    } catch (err) {
        console.error("[BatchCycle] getSocietySettlement error:", err.message);
        return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};

/**
 * GET /api/v1/admin/trainers/:professionalId/school-settlement
 * Returns school → activity → batch → cycles breakdown for a trainer.
 */
exports.getSchoolSettlement = async (req, res) => {
    try {
        const professionalId = parseInt(req.params.professionalId);
        if (isNaN(professionalId)) return res.status(400).json({ success: false, error: "Invalid professionalId" });
        const data = await service.getSchoolSettlement(professionalId);
        return res.status(200).json(data);
    } catch (err) {
        console.error("[BatchCycle] getSchoolSettlement error:", err.message);
        return res.status(err.statusCode || 500).json({ success: false, error: err.message });
    }
};

/**
 * POST /api/v1/admin/batches/batch-cycles/:cycleId/settle
 * Handled in batchroute.js via batchcontroller — kept there for batch ownership context.
 * This file only handles the society/school settlement GETs.
 */
