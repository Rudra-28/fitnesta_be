const express = require("express");
const router = express.Router();
const guard = require("../adminmiddleware");
const controller = require("./sessioncontroller");

router.use(guard);

router.post("/",          controller.createSession);                                    // POST   /api/v1/admin/sessions
router.post("/generate",  controller.generateIndividualSessions);                       // POST   /api/v1/admin/sessions/generate
router.post("/extend",    controller.extendMembership);                                 // POST   /api/v1/admin/sessions/extend
router.get("/",           controller.listSessions);                                     // GET    /api/v1/admin/sessions?student_id=&professional_id=&from=&to=&status=&session_type=
router.get("/students/:studentId/batches", controller.getStudentSessionBatches);        // GET    /api/v1/admin/sessions/students/:studentId/batches
router.get("/preview",    controller.previewSessionGeneration);                         // GET    /api/v1/admin/sessions/preview?session_type=&student_id=&start_date=&days_of_week=
router.delete("/bulk-future", controller.bulkDeleteFutureSessions);                     // DELETE /api/v1/admin/sessions/bulk-future        — delete all upcoming sessions for a student
router.get("/:sessionId",           controller.getSession);                             // GET    /api/v1/admin/sessions/:sessionId
router.patch("/:sessionId/reschedule", controller.rescheduleSession);                   // PATCH  /api/v1/admin/sessions/:sessionId/reschedule
router.put("/:sessionId/status",    controller.updateSessionStatus);                    // PUT    /api/v1/admin/sessions/:sessionId/status
router.delete("/:sessionId",        controller.deleteSession);                          // DELETE /api/v1/admin/sessions/:sessionId          — hard delete (not cancel)
router.get("/:sessionId/feedback",  controller.getSessionFeedback);                     // GET    /api/v1/admin/sessions/:sessionId/feedback

module.exports = router;
