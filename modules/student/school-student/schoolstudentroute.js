const express = require("express");
const router = express.Router();
const schoolStudentController = require("./schoolstudentcontroller");
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");

router.post("/submit", verifyMobileUnique, schoolStudentController.submitRegistration);
router.post("/payment-webhook", schoolStudentController.handlePaymentWebhook);
router.get("/status/:temp_uuid", schoolStudentController.checkRegistrationStatus);

module.exports = router;
