const express = require("express");
const router = express.Router();
const otherareaController = require("./otherareacontroller");
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");

const upload = require("../../../utils/fileupload");

const areaUploads = upload.fields([
    { name: 'activityAgreementPdf', maxCount: 1 }
]);

// 🚀 Register Society
router.post(
  "/",         
  areaUploads,
  verifyMobileUnique,    
  otherareaController.registerOtherarea
);
module.exports = router;
