const express = require("express");
const router = express.Router();
const guard = require("../adminmiddleware");
const controller = require("./batchcontroller");

router.use(guard);

router.get("/professionals", controller.getAvailableProfessionalsForBatch);                     // GET    /api/v1/admin/batches/professionals?type=trainer|teacher
router.get("/unassigned-students", controller.getUnassignedGroupStudents);                   // GET    /api/v1/admin/batches/unassigned-students?society_id=&activity_id=
router.post("/", controller.createBatch);                                                    // POST   /api/v1/admin/batches
router.get("/", controller.listBatches);                                                     // GET    /api/v1/admin/batches?batch_type=&society_id=&school_id=&activity_id=
router.get("/:batchId/detail", controller.getBatchDetail);                                   // GET    /api/v1/admin/batches/:batchId/detail
router.get("/:batchId", controller.getBatch);                                                // GET    /api/v1/admin/batches/:batchId
router.put("/:batchId", controller.updateBatch);                                             // PUT    /api/v1/admin/batches/:batchId
router.delete("/:batchId", controller.deleteBatch);                                          // DELETE /api/v1/admin/batches/:batchId
router.post("/:batchId/students", controller.bulkAssignStudents);                            // POST   /api/v1/admin/batches/:batchId/students
router.delete("/:batchId/students/:studentId", controller.removeBatchStudent);               // DELETE /api/v1/admin/batches/:batchId/students/:studentId
router.post("/:batchId/generate-sessions", controller.generateSessions);                     // POST   /api/v1/admin/batches/:batchId/generate-sessions
router.post("/:batchId/sessions", controller.createBatchSession);                            // POST   /api/v1/admin/batches/:batchId/sessions
router.get("/:batchId/professionals", controller.getAvailableProfessionalsForBatch);            // GET    /api/v1/admin/batches/:batchId/professionals
router.patch("/:batchId/sessions/:sessionId/reassign", controller.reassignBatchSession);     // PATCH  /api/v1/admin/batches/:batchId/sessions/:sessionId/reassign
router.post("/:batchId/reassign-all", controller.reassignAllFutureBatchSessions);            // POST   /api/v1/admin/batches/:batchId/reassign-all
router.post("/:batchId/students/:studentId/extend-term", controller.extendStudentTerm);      // POST   /api/v1/admin/batches/:batchId/students/:studentId/extend-term
router.get("/:batchId/settlement-preview", controller.getSettlementPreview);                 // GET    /api/v1/admin/batches/:batchId/settlement-preview
router.post("/:batchId/settle", controller.settleBatchCycle);                                // POST   /api/v1/admin/batches/:batchId/settle
router.get("/:batchId/settlements", controller.listSettlements);                             // GET    /api/v1/admin/batches/:batchId/settlements
router.patch("/settlements/:settlementId/mark-paid", controller.markSettlementPaid);         // PATCH  /api/v1/admin/batches/settlements/:settlementId/mark-paid

module.exports = router;
