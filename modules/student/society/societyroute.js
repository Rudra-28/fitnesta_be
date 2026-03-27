const express = require("express");
const router = express.Router();
const societyController = require("./societycontroller");
const upload = require("../../../utils/fileupload");
const meGuard = require("../../professionals/marketingExe/dashboard/memiddleware");
const adminGuard = require("../../admin/adminmiddleware");

const societyUploads = upload.fields([
    { name: 'activityAgreementPdf', maxCount: 1 }
]);

// Multer error handler — catches wrong field names from frontend
const handleUpload = (req, res, next) => {
    societyUploads(req, res, (err) => {
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

// Public / student routes
router.post("/", handleUpload, societyController.registerSociety);
router.get("/", societyController.getSocieties);

// Admin — society_request
router.get("/admin/requests/pending",       adminGuard, societyController.listPendingRequests);
router.post("/admin/requests/approve/:id",  adminGuard, societyController.approveRequest);
router.post("/admin/requests/reject/:id",   adminGuard, societyController.rejectRequest);

// Admin — society_enrollment
router.get("/admin/enrollments/pending",      adminGuard, societyController.listPendingEnrollments);
router.post("/admin/enrollments/approve/:id", adminGuard, societyController.approveEnrollmentByAdmin);
router.post("/admin/enrollments/reject/:id",  adminGuard, societyController.rejectEnrollmentByAdmin);

// ME — society_enrollment only
router.get("/me/enrollments/pending",       meGuard, societyController.listPendingEnrollmentsForMe);
router.post("/me/enrollments/approve/:id",  meGuard, societyController.approveEnrollmentByMe);
router.post("/me/enrollments/reject/:id",   meGuard, societyController.rejectEnrollmentByMe);

module.exports = router;
