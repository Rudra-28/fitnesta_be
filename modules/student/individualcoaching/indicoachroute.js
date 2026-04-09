const express = require("express");
const router = express.Router();
const indicoachcontroller = require("./indicoachcontroller");
const editController = require("./indicoachEditController");
const { verifyAccessToken } = require("../../../middleware/authmiddleware");
const upload = require("../../../utils/fileupload");

const icUploads = upload.fields([
    { name: "signatureUrl", maxCount: 1 },
    { name: "signature_url", maxCount: 1 },
]);

router.post("/send-IC", icUploads, indicoachcontroller.submitRegistration);
router.post("/send-GC", icUploads, indicoachcontroller.submitRegistration);
router.get("/status/:temp_uuid", indicoachcontroller.checkRegistrationStatus);
router.patch("/edit-profile", verifyAccessToken, editController.editIC);

module.exports = router;
