const express = require("express");
const router = express.Router();
const controller = require("./medashboardcontroller");
const meGuard = require("./memiddleware");
const localUpload = require("../../../../utils/localUpload");

const docUpload = localUpload.fields([
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
        if (err && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: "File is too large. Maximum file size allowed is 2MB."
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
// Withdrawal is handled by admin manually — no professional-initiated withdrawal routes.

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

// ── Visiting Form ──────────────────────────────────────────────────────────
router.get("/me-list", meGuard, controller.getMeReferralCodes);           // GET  dropdown of ME referral codes
router.post("/visiting-form", meGuard, controller.submitVisitingForm);    // POST submit a visiting form
router.get("/visiting-forms", meGuard, controller.getMyVisitingForms);    // GET  list all my visiting forms
router.get("/visiting-form/:id", meGuard, controller.getVisitingFormById); // GET  single visiting form

module.exports = router;
