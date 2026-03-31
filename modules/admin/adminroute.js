const express = require("express");
const router = express.Router();
const guard = require("./adminmiddleware");
const controller = require("./admincontroller");

router.use(guard); // every route below requires a valid admin JWT

router.get("/pending", controller.listPending);                            // GET  /api/v1/admin/pending?type=trainer
router.get("/pending/:id", controller.listPending);                        // GET  /api/v1/admin/pending/:id
router.post("/approve/:id", controller.approve);                           // POST /api/v1/admin/approve/5
router.post("/reject/:id", controller.reject);                             // POST /api/v1/admin/reject/5

// ── Approved professionals list ───────────────────────────────────────────
router.get("/professionals", controller.listProfessionals);                // GET /api/v1/admin/professionals?type=trainer

// ── Student assignment ─────────────────────────────────────────────────────
router.get("/students/unassigned", controller.getUnassignedStudents);         // GET  /api/v1/admin/students/unassigned?service=personal_tutor
router.get("/professionals/available", controller.getAvailableProfessionals); // GET  /api/v1/admin/professionals/available?type=teacher
router.post("/assign/teacher", controller.assignTeacher);                     // POST /api/v1/admin/assign/teacher
router.post("/assign/trainer", controller.assignTrainer);                     // POST /api/v1/admin/assign/trainer

// ── Commission rules (admin can view and edit rates) ──────────────────────
router.get("/commission-rules", controller.listCommissionRules);              // GET  /api/v1/admin/commission-rules
router.put("/commission-rules/:ruleKey", controller.updateCommissionRule);    // PUT  /api/v1/admin/commission-rules/trainer_personal_coaching_rate

// ── Commissions earned by professionals ───────────────────────────────────
// Filters: ?professional_type=trainer|teacher|marketing_executive  &status=pending|paid  &professional_id=5
router.get("/commissions", controller.listCommissions);                       // GET  /api/v1/admin/commissions
router.patch("/commissions/:id/mark-paid", controller.markCommissionPaid);    // PATCH /api/v1/admin/commissions/3/mark-paid

// ── Trainer travelling allowances ─────────────────────────────────────────
// Filters: ?trainer_professional_id=5  &status=pending|paid
router.get("/travelling-allowances", controller.listTravellingAllowances);              // GET  /api/v1/admin/travelling-allowances
router.patch("/travelling-allowances/:id/mark-paid", controller.markTravellingAllowancePaid); // PATCH /api/v1/admin/travelling-allowances/7/mark-paid

module.exports = router;
