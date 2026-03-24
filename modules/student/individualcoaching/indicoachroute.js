const express = require("express");
const router = express.Router();
const indicoachcontroller = require("./indicoachcontroller");
const upload = require("../../../utils/fileupload");
const validate = require("../../student/individualcoaching/indicoachvalidate");

const icUploads = upload.fields([
    { name: 'signatureUrl', maxCount: 1 },
    { name: 'signature_url', maxCount: 1 }
]);

// Only the Flutter app with the Secret Key can hit this
router.post("/send-IC", icUploads, indicoachcontroller.submitRegistration);

// Public but secured by Signature Verification inside the controller
router.post("/payment-webhook", indicoachcontroller.handlePaymentWebhook);

// Flutter app uses this to get the JWT after payment
router.get("/status/:temp_uuid", indicoachcontroller.checkRegistrationStatus);

// A temporary route just for your development phase
router.post("/mock-payment-success", indicoachcontroller.mockPayment);

module.exports = router;