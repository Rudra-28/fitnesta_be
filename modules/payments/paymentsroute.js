const express = require("express");
const router = express.Router();
const { handlePaymentWebhook, verifyPayment } = require("./paymentscontroller");

// POST /api/v1/payments/verify  — called by Flutter after Razorpay SDK closes
router.post("/verify", verifyPayment);

// POST /api/v1/payments/webhook — called by Razorpay server (when webhook is configured)
router.post("/webhook", handlePaymentWebhook);

module.exports = router;
