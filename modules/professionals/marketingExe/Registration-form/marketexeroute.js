const express = require("express");
const router = express.Router();
const controller = require("./marketexecontroller");
const editController = require("./marketexeEditController");
const { verifyMobileUnique } = require("../../../../middleware/checkduplicate");
const { verifyAccessToken } = require("../../../../middleware/authmiddleware");
const upload = require("../../../../utils/fileupload");

const marketUploads = upload.fields([
  { name: 'panCard', maxCount: 1 },
  { name: 'adharCard', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'activityAgreementsPdf', maxCount: 1 }
]);

const editUploads = upload.fields([
  { name: 'photo', maxCount: 1 },
]);

// upload must run before verifyMobileUnique so multipart body is parsed first
router.post("/", marketUploads, verifyMobileUnique, controller.createMarketExe);
router.get("/", controller.getAllMarketexe);
router.patch("/edit-profile", verifyAccessToken, editUploads, editController.editME);

module.exports = router;
