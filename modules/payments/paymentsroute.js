const express = require("express");
const router = express.Router();
const { handlePaymentWebhook, verifyPayment, devFinalize } = require("./paymentscontroller");

// POST /api/v1/payments/verify  — called by Flutter after Razorpay SDK closes
router.post("/verify", verifyPayment);

// POST /api/v1/payments/webhook — called by Razorpay server (when webhook is configured)
router.post("/webhook", handlePaymentWebhook);

// DEV ONLY — bypass Razorpay and finalize any pending registration directly
// Remove DEV_SKIP_PAYMENT from .env to disable this in production
if (process.env.DEV_SKIP_PAYMENT === "true") {
    router.post("/dev-finalize/:temp_uuid", devFinalize);
    console.log("[DEV] POST /api/v1/payments/dev-finalize/:temp_uuid is ACTIVE — remove DEV_SKIP_PAYMENT before going live");
}

module.exports = router;
