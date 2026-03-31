const express = require("express");
const router = express.Router();
const personaltutorController = require("./perstutorcontroller");
const upload = require("../../../utils/fileupload");

const ptUploads = upload.fields([
    { name: "signatureUrl", maxCount: 1 },
]);

router.post("/send-PT", ptUploads, personaltutorController.submitRegistration);
router.get("/status/:temp_uuid", personaltutorController.checkRegistrationStatus);

module.exports = router;
