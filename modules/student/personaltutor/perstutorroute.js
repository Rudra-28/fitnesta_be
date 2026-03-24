const express = require("express");
const router = express.Router();
const { verifyAppSecret } = require("../../../middleware/authMiddleware");
const personaltutorController = require("./perstutorcontroller");
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");

const upload = require("../../../utils/fileupload");

const ptUploads = upload.fields([
    { name: 'signatureUrl', maxCount: 1 }
]);

// Only the Flutter app with the Secret Key can hit this
router.post("/send-PT", ptUploads, personaltutorController.submitRegistration);

// Public but secured by Signature Verification inside the controller
router.post("/payment-webhook", personaltutorController.handlePaymentWebhook);

// Flutter app uses this to get the JWT after payment
router.get("/status/:temp_uuid", personaltutorController.checkRegistrationStatus);

// A temporary route just for your development phase
router.post("/mock-payment-success", personaltutorController.mockPayment);

module.exports = router;