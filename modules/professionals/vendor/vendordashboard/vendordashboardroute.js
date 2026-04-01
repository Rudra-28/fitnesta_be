const express = require("express");
const router = express.Router();
const vendorGuard = require("./vendormiddleware");
const upload = require("../../../../utils/fileupload");
const controller = require("./vendordashboardcontroller");
const kitOrderController = require("../../../student/kitorder/kitordercontroller");

const productImageUpload = upload.single("productImage");

const handleUpload = (req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/json")) return next();
    productImageUpload(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
};

// ── Products ───────────────────────────────────────────────────────────────
router.post("/products", vendorGuard, handleUpload, controller.addProduct);
router.get("/products", vendorGuard, controller.getProducts);
router.get("/products/:id", vendorGuard, controller.getProductById);
router.put("/products/:id", vendorGuard, handleUpload, controller.updateProduct);
router.delete("/products/:id", vendorGuard, controller.deleteProduct);

// ── Orders ─────────────────────────────────────────────────────────────────
router.get("/orders",                        vendorGuard, kitOrderController.getVendorOrders);
router.patch("/orders/:order_id/status",     vendorGuard, kitOrderController.updateOrderStatus);

module.exports = router;
