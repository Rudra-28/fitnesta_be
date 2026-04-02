const express = require("express");
const router = express.Router();
const guard = require("../adminmiddleware");
const controller = require("./batchcontroller");

router.use(guard);

router.post("/", controller.createBatch);                                         // POST   /api/v1/admin/batches
router.get("/", controller.listBatches);                                          // GET    /api/v1/admin/batches?batch_type=&society_id=&school_id=&activity_id=
router.get("/:batchId", controller.getBatch);                                     // GET    /api/v1/admin/batches/:batchId
router.put("/:batchId", controller.updateBatch);                                  // PUT    /api/v1/admin/batches/:batchId
router.delete("/:batchId", controller.deleteBatch);                               // DELETE /api/v1/admin/batches/:batchId
router.post("/:batchId/students", controller.bulkAssignStudents);                 // POST   /api/v1/admin/batches/:batchId/students
router.delete("/:batchId/students/:studentId", controller.removeBatchStudent);    // DELETE /api/v1/admin/batches/:batchId/students/:studentId
router.post("/:batchId/generate-sessions", controller.generateSessions);          // POST   /api/v1/admin/batches/:batchId/generate-sessions

module.exports = router;
