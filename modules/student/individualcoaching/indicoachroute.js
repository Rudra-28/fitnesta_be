const express = require("express");
const router = express.Router();
const { verifyAppSecret } = require("../../../middleware/authMiddleware");
const indicoachcontroller = require("./indicoachcontroller");
// Only the Flutter app with the Secret Key can hit this
router.post("/send-PT", indicoachcontroller.submitRegistration);

// Public but secured by Signature Verification inside the controller
router.post("/payment-webhook", indicoachcontroller.handlePaymentWebhook);

// Flutter app uses this to get the JWT after payment
router.get("/status/:temp_uuid", indicoachcontroller.checkRegistrationStatus);

// A temporary route just for your development phase
router.post("/mock-payment-success", indicoachcontroller.mockPayment);

module.exports = router;