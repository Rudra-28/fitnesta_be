const express = require("express");
const router = express.Router();
const vendorController = require("../professionals/vendor/vendordashboard/vendordashboardcontroller");
const kitOrderController = require("./kitorder/kitordercontroller");
const studentGuard = require("./studentmiddleware");
const sessionController = require("./studentdashboardcontroller");

// ── Products (Kits) — public ───────────────────────────────────────────────
router.get("/products", vendorController.getAllProductsPublic);
router.get("/products/:id", vendorController.getProductByIdPublic);

// ── Kit Orders ─────────────────────────────────────────────────────────────
router.post("/orders", studentGuard, kitOrderController.initiateKitOrder);

// DEV ONLY — simulate payment confirmation without Razorpay
if (process.env.DEV_SKIP_PAYMENT === "true") {
    router.post("/orders/:temp_uuid/dev-confirm", studentGuard, kitOrderController.devFinalizeKitOrder);
}

// ── Session schedule ───────────────────────────────────────────────────────────
router.get("/sessions", studentGuard, sessionController.getUpcomingSessions);
router.get("/sessions/history", studentGuard, sessionController.getSessionHistory);
router.post("/sessions/:id/feedback", studentGuard, sessionController.submitFeedback);

module.exports = router;
