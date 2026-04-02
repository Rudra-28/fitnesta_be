const express = require("express");
const router = express.Router();
const teacherGuard = require("./teachermiddleware");
const controller = require("./teacherdashboardcontroller");

// Summary: total + per-standard student counts
router.get("/summary", teacherGuard, controller.getSummary);

// Students list — ?standard=1ST-2ND | 3RD-4TH | 5TH-6TH | 7TH-8TH | 8TH-10TH | ANY | ALL
router.get("/students", teacherGuard, controller.getStudents);

// Session schedule
router.get("/sessions", teacherGuard, controller.getUpcomingSessions);
router.get("/sessions/history", teacherGuard, controller.getSessionHistory);

module.exports = router;
