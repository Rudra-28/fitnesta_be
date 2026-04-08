const express = require("express");
const router = express.Router();
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");
const controller = require("./trainercontroller");
const editController = require("./trainerEditController");
const upload = require("../../../utils/fileupload");
const { verifyAccessToken } = require("../../../middleware/authmiddleware");

const trainUploads = upload.fields([
    { name: 'panCard' },
    { name: 'adharCard' },
    { name: 'qualificationDocs' },
    { name: 'photo' },
    { name: 'documents' }
]);

const editUploads = upload.fields([
    { name: 'photo' },
]);

router.post("/", trainUploads, verifyMobileUnique, controller.createTrainer);
router.patch("/edit-profile", verifyAccessToken, editUploads, editController.editTrainer);

module.exports = router;