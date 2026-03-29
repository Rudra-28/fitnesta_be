const express = require("express");
const router = express.Router();
const vendorGuard = require("./vendormiddleware");
const upload = require("../../../../utils/fileupload");
const controller = require("./vendordashboardcontroller");

const productImageUpload = upload.single("productImage");

const handleUpload = (req, res, next) => {
    productImageUpload(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    });
};

// ── Public (no auth) ───────────────────────────────────────────────────────
router.get("/products/public", controller.getAllProductsPublic);

// ── Products ───────────────────────────────────────────────────────────────
router.post("/products", vendorGuard, handleUpload, controller.addProduct);
router.get("/products", vendorGuard, controller.getProducts);
router.get("/products/:id", vendorGuard, controller.getProductById);
router.put("/products/:id", vendorGuard, handleUpload, controller.updateProduct);
router.delete("/products/:id", vendorGuard, controller.deleteProduct);

module.exports = router;
