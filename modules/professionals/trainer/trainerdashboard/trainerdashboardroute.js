const express = require("express");
const router = express.Router();
const trainerGuard = require("./trainermiddleware");
const controller = require("./trainerdashboardcontroller");

router.get("/sessions", trainerGuard, controller.getSessions);
router.get("/sessions/:sessionId", trainerGuard, controller.getSessionById);               // GET /api/v1/trainer-dashboard/sessions/:sessionId                             // GET   /api/v1/trainer-dashboard/sessions?status=upcoming|ongoing|history
router.patch("/sessions/:sessionId/punch-in", trainerGuard, controller.punchIn);           // PATCH /api/v1/trainer-dashboard/sessions/:sessionId/punch-in
router.patch("/sessions/:sessionId/punch-out", trainerGuard, controller.punchOut);         // PATCH /api/v1/trainer-dashboard/sessions/:sessionId/punch-out
router.get("/activities", trainerGuard, controller.getActivities);                         // GET   /api/v1/trainer-dashboard/activities
router.get("/batches/:batchId/students", trainerGuard, controller.getBatchStudents);       // GET /api/v1/trainer-dashboard/batches/:batchId/students
router.get("/batches/:batchId/sessions", trainerGuard, controller.getBatchSessions);       // GET /api/v1/trainer-dashboard/batches/:batchId/sessions?status=       // GET   /api/v1/trainer-dashboard/batches/:batchId/students
router.get("/students", trainerGuard, controller.getAllStudents);                           // GET /api/v1/trainer-dashboard/students
router.get("/students/:studentId/sessions", trainerGuard, controller.getStudentSessions);  // GET /api/v1/trainer-dashboard/students/:studentId/sessions?status=
router.get("/batches", trainerGuard, controller.getBatchesByLocation);                     // GET /api/v1/trainer-dashboard/batches?location=society|school
router.get("/batches/all", trainerGuard, controller.getTrainerBatches);                    // GET /api/v1/trainer-dashboard/batches/all                        // GET   /api/v1/trainer-dashboard/batches useless for now
router.get("/sports", trainerGuard, controller.getSportsActivities);                        // GET /api/v1/trainer-dashboard/sports
router.get("/sports/sessions", trainerGuard, controller.getSessionsByActivity);            // GET /api/v1/trainer-dashboard/sports/sessions?activity_id=1&status=upcoming
router.get("/wallet", trainerGuard, controller.getWalletSummary);                             // GET  /api/v1/trainer-dashboard/wallet
router.get("/wallet/transactions", trainerGuard, controller.getTransactionHistory);  // GET /api/v1/trainer-dashboard/wallet/transactions
router.get("/wallet/:status", trainerGuard, controller.getWalletBreakdown);
router.put("/wallet/payout-details", trainerGuard, controller.savePayoutDetails);                               // PUT  /api/v1/trainer-dashboard/wallet/payout-details
router.post("/wallet/withdraw-request", trainerGuard, controller.withdrawRequest);           // POST /api/v1/trainer-dashboard/wallet/withdraw-request
router.post("/wallet/withdraw-now", trainerGuard, controller.withdrawNow);                   // POST /api/v1/trainer-dashboard/wallet/withdraw-now

module.exports = router;
