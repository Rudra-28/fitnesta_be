const express = require("express");
const router = express.Router();
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");
const controller = require("./trainercontroller");
const upload = require("../../../utils/fileupload");
const {validateTrainer} = require("./validate");

const trainUploads = upload.fields([
    { name: 'panCard' },
    { name: 'adharCard' },
    { name: 'qualificationDocs' },
    { name: 'photo' },
    { name: 'documents' }
  ]);
  router.post("/", trainUploads, verifyMobileUnique, controller.createTrainer);

module.exports = router;