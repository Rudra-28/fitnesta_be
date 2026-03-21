const express = require("express");
const router = express.Router();
const schoolController = require("./schoolcontroller");

// POST /api/v1/school/
router.post("/", schoolController.registerSchool);

// GET /api/v1/school/
router.get("/", schoolController.getAllSchools);

module.exports = router;
