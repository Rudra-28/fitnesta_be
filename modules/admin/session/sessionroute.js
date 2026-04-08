const express = require("express");
const router = express.Router();
const guard = require("../adminmiddleware");
const controller = require("./sessioncontroller");

router.use(guard);

router.post("/", controller.createSession);                                    // POST   /api/v1/admin/sessions
router.post("/generate", controller.generateIndividualSessions);               // POST   /api/v1/admin/sessions/generate  — auto-generate IC/PT sessions
router.get("/", controller.listSessions);                                      // GET    /api/v1/admin/sessions?student_id=&professional_id=&from=&to=&status=&session_type=
router.get("/:sessionId", controller.getSession);                              // GET    /api/v1/admin/sessions/:sessionId
router.put("/:sessionId/status", controller.updateSessionStatus);              // PUT    /api/v1/admin/sessions/:sessionId/status
router.delete("/:sessionId", controller.cancelSession);                        // DELETE /api/v1/admin/sessions/:sessionId
router.get("/:sessionId/feedback", controller.getSessionFeedback);             // GET    /api/v1/admin/sessions/:sessionId/feedback

module.exports = router;
