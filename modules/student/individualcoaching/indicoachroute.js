const express = require("express");
const router = express.Router();
const indicoachcontroller = require("./indicoachcontroller");
const upload = require("../../../utils/fileupload");

const icUploads = upload.fields([
    { name: "signatureUrl", maxCount: 1 },
    { name: "signature_url", maxCount: 1 },
]);

router.post("/send-IC", icUploads, indicoachcontroller.submitRegistration);
router.get("/status/:temp_uuid", indicoachcontroller.checkRegistrationStatus);

module.exports = router;
