const express = require("express");
const router = express.Router();
const teacherGuard = require("./teachermiddleware");
const controller = require("./teacherdashboardcontroller");

// Summary: total + per-standard student counts
router.get("/summary", teacherGuard, controller.getSummary);
// Subjects grouped view (mirrors Total Activities screen)
router.get("/subjects", teacherGuard, controller.getSubjects);                              // GET /api/v1/teacher-dashboard/subjects
// Students list — ?standard=1ST-2ND | 3RD-4TH | 5TH-6TH | 7TH-8TH | 8TH-10TH | ANY | ALL
router.get("/students", teacherGuard, controller.getStudents);
router.get("/students/:tutorRecordId", teacherGuard, controller.getStudentDetail);          // GET /api/v1/teacher-dashboard/students/:tutorRecordId
// Session schedulez
router.get("/sessions", teacherGuard, controller.getSessions);
router.get("/sessions/:id", teacherGuard, controller.getSessionById);                       // GET /api/v1/teacher-dashboard/sessions/:id                              // GET /api/v1/teacher-dashboard/sessions?status=upcoming|ongoing|history
router.post("/sessions/:id/start", teacherGuard, controller.startSession);
router.post("/sessions/:id/end", teacherGuard, controller.endSession);
router.get("/wallet", teacherGuard, controller.getWalletSummary);                            // GET  /api/v1/teacher-dashboard/wallet
router.get("/wallet/transactions", teacherGuard, controller.getTransactionHistory);  // GET /api/v1/teacher-dashboard/wallet/transactions
router.get("/wallet/:status", teacherGuard, controller.getWalletBreakdown);
router.put("/wallet/payout-details", teacherGuard, controller.savePayoutDetails);                              // PUT  /api/v1/teacher-dashboard/wallet/payout-details
router.post("/wallet/withdraw-request", teacherGuard, controller.withdrawRequest);          // POST /api/v1/teacher-dashboard/wallet/withdraw-request
router.post("/wallet/withdraw-now", teacherGuard, controller.withdrawNow);                  // POST /api/v1/teacher-dashboard/wallet/withdraw-now

module.exports = router;
