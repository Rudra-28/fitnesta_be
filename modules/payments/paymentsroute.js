const express = require("express");
const router = express.Router();
const { handlePaymentWebhook, handlePayoutWebhook, verifyPayment, devFinalize, listReceipts, getReceipt, downloadReceiptPDF } = require("./paymentscontroller");
const studentAuth = require("../student/studentmiddleware");

// POST /api/v1/payments/verify  — called by Flutter after Razorpay SDK closes
router.post("/verify", verifyPayment);

// GET /api/v1/payments/receipts          — list all receipts for the logged-in student
router.get("/receipts", studentAuth, listReceipts);

// GET /api/v1/payments/receipt/:temp_uuid — single receipt detail
router.get("/receipt/:temp_uuid", studentAuth, getReceipt);

// GET /api/v1/payments/receipt/:temp_uuid/pdf — stream PDF download
router.get("/receipt/:temp_uuid/pdf", studentAuth, downloadReceiptPDF);

// POST /api/v1/payments/webhook        — Razorpay payment events (payment.captured)
router.post("/webhook", handlePaymentWebhook);

// POST /api/v1/payments/payout-webhook — Razorpay X payout events (payout.processed / payout.failed)
router.post("/payout-webhook", handlePayoutWebhook);

// DEV ONLY — bypass Razorpay and finalize any pending registration directly
// Remove DEV_SKIP_PAYMENT from .env to disable this in production
if (process.env.DEV_SKIP_PAYMENT === "true") {
    router.post("/dev-finalize/:temp_uuid", devFinalize);
    console.log("[DEV] POST /api/v1/payments/dev-finalize/:temp_uuid is ACTIVE — remove DEV_SKIP_PAYMENT before going live");
}

module.exports = router;
