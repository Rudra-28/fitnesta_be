const express = require("express");
const router = express.Router();
const vendorController = require("../professionals/vendor/vendordashboard/vendordashboardcontroller");
const kitOrderController = require("./kitorder/kitordercontroller");
const studentGuard = require("./studentmiddleware");

// ── Products (Kits) — public ───────────────────────────────────────────────
router.get("/products", vendorController.getAllProductsPublic);

// ── Kit Orders ─────────────────────────────────────────────────────────────
router.post("/orders", studentGuard, kitOrderController.createKitOrder);

// DEV ONLY — simulate payment confirmation without Razorpay
if (process.env.DEV_SKIP_PAYMENT === "true") {
    router.post("/orders/:kit_order_id/dev-confirm", studentGuard, kitOrderController.devFinalizeKitOrder);
}

module.exports = router;
