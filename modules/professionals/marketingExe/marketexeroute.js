const express = require("express");
const router = express.Router();
const controller = require("./marketexecontroller");
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");
const upload = require("../../../utils/fileupload");

const marketUploads = upload.fields([
  { name: 'panCard',               maxCount: 1 },
  { name: 'adharCard',             maxCount: 1 },
  { name: 'photo',                 maxCount: 1 },
  { name: 'activityAgreementsPdf', maxCount: 1 }
]);

// upload must run before verifyMobileUnique so multipart body is parsed first
router.post("/", marketUploads, verifyMobileUnique, controller.createMarketExe);
router.get("/", controller.getAllMarketexe);

module.exports = router;