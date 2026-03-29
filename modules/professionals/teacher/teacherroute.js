const express = require("express");
const router = express.Router();
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");
const upload = require("../../../utils/fileupload");
const controller = require("./teachercontroller");

const teacherUploads = upload.fields([
  { name: 'panCard' },
  { name: 'adharCard' },
  { name: 'bedDoc' },
  { name: 'dedDoc' },
  { name: 'otherDoc' }
]);

// teacherUploads must come before verifyMobileUnique so multipart body is parsed first.
// Validation is handled inside the service (not as route middleware).
router.post("/", teacherUploads, verifyMobileUnique, controller.createTeacher);
module.exports = router;