const express = require("express");
const router = express.Router();
const controller = require("./activitiescontroller");

// GET /api/v1/activities?coaching_type=individual_coaching
// GET /api/v1/activities?coaching_type=school_student
// GET /api/v1/activities?coaching_type=group_coaching
// GET /api/v1/activities?coaching_type=personal_tutor
// GET /api/v1/activities                              (plain list, no fees)
router.get("/", controller.getActivities);
router.get("/subjects", controller.getSubjects);

module.exports = router;
