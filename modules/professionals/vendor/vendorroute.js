// const express = require("express");
// const router = express.Router();
// const { verifyMobileUnique } = require("../../../middleware/checkduplicate");

// const controller = require("./vendorcontroller");

// router.post("/",verifyMobileUnique, controller.createVendors);
// router.get("/", controller.getAllVendors);

// module.exports = router;

const express = require("express");
const router = express.Router();
const vendorController = require("./vendorcontroller");
const upload = require("../../../utils/fileupload");
const { validateVendors } = require("./vendorvalidate");
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");
const vendorUploads = upload.fields([
  { name: 'GSTCertificate', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'adharCard', maxCount: 1 }  // single 'a'
]);

router.post("/", vendorUploads, verifyMobileUnique, vendorController.createVendors);
router.get("/", vendorController.getAllVendors);

module.exports = router;