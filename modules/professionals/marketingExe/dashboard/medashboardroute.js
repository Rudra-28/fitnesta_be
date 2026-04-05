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

// ── Earnings / Wallet ──────────────────────────────────────────────────────
router.get("/earnings", meGuard, controller.getEarnings);
router.get("/wallet",           meGuard, controller.getWalletSummary);        // GET  /api/v1/me-dashboard/wallet
router.get("/wallet/transactions",   meGuard, controller.getTransactionHistory);  // GET /api/v1/me-dashboard/wallet/transactions
router.get("/wallet/:status",   meGuard, controller.getWalletBreakdown);
router.put("/wallet/payout-details",               meGuard, controller.savePayoutDetails);       // PUT  /api/v1/me-dashboard/wallet/payout-details
router.post("/wallet/withdraw-request", meGuard, controller.withdrawRequest); // POST /api/v1/me-dashboard/wallet/withdraw-request
router.post("/wallet/withdraw-now",     meGuard, controller.withdrawNow);     // POST /api/v1/me-dashboard/wallet/withdraw-now

// ── Society ────────────────────────────────────────────────────────────────
router.post("/society", meGuard, handleUpload, controller.registerSociety);
router.get("/societies", meGuard, controller.getMySocieties);
router.get("/society/:id", meGuard, controller.getSocietyById);

// ── School ─────────────────────────────────────────────────────────────────
router.post("/school", meGuard, handleUpload, controller.registerSchool);
router.get("/schools", meGuard, controller.getMySchools);
router.get("/schools/enrollment", meGuard, controller.getMySchoolsEnrollment);
router.get("/school/:id", meGuard, controller.getSchoolById);

// ── Students (Total Students screen) ───────────────────────────────────────
router.get("/students/schools", meGuard, controller.getSchoolStudents);
router.get("/students/societies", meGuard, controller.getSocietyStudents);
router.get("/students/school/:schoolId", meGuard, controller.getStudentsBySchool);
router.get("/students/school-student/:id", meGuard, controller.getSchoolStudentById);
router.get("/students/society/:societyId", meGuard, controller.getStudentsBySociety);

module.exports = router;
