const express = require("express");
const router = express.Router();
const controller = require("./medashboardcontroller");
const meGuard = require("./memiddleware");
const upload = require("../../../../utils/fileupload");

const docUpload = upload.fields([
    { name: 'activityAgreementPdf', maxCount: 1 }
]);

const handleUpload = (req, res, next) => {
    docUpload(req, res, (err) => {
        if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: `Unexpected file field "${err.field}". Expected field name: activityAgreementPdf`
            });
        }
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
};

// ── Dashboard Summary ──────────────────────────────────────────────────────
router.get("/summary", meGuard, controller.getSummary);

// ── Society ────────────────────────────────────────────────────────────────
router.post("/society", meGuard, handleUpload, controller.registerSociety);
router.get("/societies", meGuard, controller.getMySocieties);
router.get("/society/:id", meGuard, controller.getSocietyById);

// ── School ─────────────────────────────────────────────────────────────────
router.post("/school", meGuard, handleUpload, controller.registerSchool);
router.get("/schools", meGuard, controller.getMySchools);
router.get("/school/:id", meGuard, controller.getSchoolById);

module.exports = router;
