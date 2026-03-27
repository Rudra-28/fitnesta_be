const express = require("express");
const router = express.Router();
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");
const upload = require("../../../utils/fileupload");
const controller = require("./vendorcontroller");

const vendorUploads = upload.fields([
    { name: 'panCard',        maxCount: 1 },
    { name: 'adharCard',      maxCount: 1 },
    { name: 'GSTCertificate', maxCount: 1 }
]);

router.post("/", vendorUploads, verifyMobileUnique, controller.createVendors);
router.get("/", controller.getAllVendors);

module.exports = router;
