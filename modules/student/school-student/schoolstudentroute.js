const express = require("express");
const router = express.Router();
const schoolStudentController = require("./schoolstudentcontroller");
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");

// Only the Flutter app with the Secret Key can hit this (Can add verifyAppSecret back if wanted later)
router.post("/submit", verifyMobileUnique, schoolStudentController.submitRegistration);

// Public but secured by Signature Verification inside the controller
router.post("/payment-webhook", schoolStudentController.handlePaymentWebhook);

// Flutter app uses this to get the JWT after payment
router.get("/status/:temp_uuid", schoolStudentController.checkRegistrationStatus);

// A temporary route just for your development phase
router.post("/mock-payment-success", schoolStudentController.mockPayment);

module.exports = router;
