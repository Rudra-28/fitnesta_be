const express = require("express");
const router = express.Router();
const schoolStudentController = require("./schoolstudentcontroller");
const editController = require("./schoolstudentEditController");
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");
const { verifyAccessToken } = require("../../../middleware/authmiddleware");

router.post("/submit", verifyMobileUnique, schoolStudentController.submitRegistration);
router.get("/status/:temp_uuid", schoolStudentController.checkRegistrationStatus);
router.patch("/edit-profile", verifyAccessToken, editController.editSchoolStudent);

// ── Dev only — manually finalize a pending registration (DEV_SKIP_PAYMENT mode) ──
if (process.env.DEV_SKIP_PAYMENT === "true") {
    router.post("/dev-finalize/:temp_uuid", schoolStudentController.devFinalize);
}

module.exports = router;
