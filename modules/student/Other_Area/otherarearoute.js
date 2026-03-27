const express    = require("express");
const router     = express.Router();
const controller = require("./otherareacontroller");
const upload     = require("../../../utils/fileupload");
const meGuard    = require("../../professionals/marketingExe/dashboard/memiddleware");
const adminGuard = require("../../admin/adminmiddleware");

const areaUploads = upload.fields([
    { name: 'activityAgreementPdf', maxCount: 1 }
]);

const handleUpload = (req, res, next) => {
    areaUploads(req, res, (err) => {
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

// Public
router.post("/", handleUpload, controller.registerOtherArea);

// Admin — other_area_request
router.get("/admin/requests/pending",       adminGuard, controller.listPendingRequests);
router.post("/admin/requests/approve/:id",  adminGuard, controller.approveRequest);
router.post("/admin/requests/reject/:id",   adminGuard, controller.rejectRequest);

// Admin — other_area_enrollment
router.get("/admin/enrollments/pending",      adminGuard, controller.listPendingEnrollments);
router.post("/admin/enrollments/approve/:id", adminGuard, controller.approveEnrollmentByAdmin);
router.post("/admin/enrollments/reject/:id",  adminGuard, controller.rejectEnrollmentByAdmin);

// ME — other_area_enrollment only
router.get("/me/enrollments/pending",       meGuard, controller.listPendingEnrollmentsForMe);
router.post("/me/enrollments/approve/:id",  meGuard, controller.approveEnrollmentByMe);
router.post("/me/enrollments/reject/:id",   meGuard, controller.rejectEnrollmentByMe);

module.exports = router;
