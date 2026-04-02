const express = require("express");
const router = express.Router();
const trainerGuard = require("./trainermiddleware");
const controller = require("./trainerdashboardcontroller");

router.get("/sessions", trainerGuard, controller.getUpcomingSessions);          // GET /api/v1/trainer-dashboard/sessions
router.get("/sessions/history", trainerGuard, controller.getSessionHistory);    // GET /api/v1/trainer-dashboard/sessions/history
router.get("/batches", trainerGuard, controller.getTrainerBatches);             // GET /api/v1/trainer-dashboard/batches

module.exports = router;
