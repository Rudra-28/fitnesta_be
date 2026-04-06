const express = require("express");
const router = express.Router();
const guard = require("./adminmiddleware");
const controller = require("./admincontroller");
const upload = require("../../utils/fileupload");

const docUpload = upload.fields([{ name: "activityAgreementPdf", maxCount: 1 }]);
const handleUpload = (req, res, next) => {
    docUpload(req, res, (err) => {
        if (err && err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({ success: false, error: `Unexpected file field "${err.field}". Expected: activityAgreementPdf` });
        }
        if (err) return res.status(400).json({ success: false, error: err.message });
        next();
    });
};

router.use(guard); // every route below requires a valid admin JWT

router.get("/pending", controller.listPending);                            // GET  /api/v1/admin/pending?type=trainer
router.get("/pending/:id", controller.listPending);                        // GET  /api/v1/admin/pending/:id
router.post("/approve/:id", controller.approve);                           // POST /api/v1/admin/approve/5
router.post("/reject/:id", controller.reject);                             // POST /api/v1/admin/reject/5

// ── Approved professionals list ───────────────────────────────────────────
router.get("/professionals", controller.listProfessionals);                // GET /api/v1/admin/professionals?type=trainer

// ── Activities (for batch creation dropdown) ──────────────────────────────
router.get("/activities", controller.listActivities);                              // GET /api/v1/admin/activities?coaching_type=group_coaching

// ── Societies ─────────────────────────────────────────────────────────────
router.get("/societies", controller.getAllSocietiesAdmin);                          // GET  /api/v1/admin/societies
router.get("/societies/:id", controller.getSocietyAdminById);                      // GET  /api/v1/admin/societies/:id
router.post("/societies", handleUpload, controller.adminRegisterSociety);           // POST /api/v1/admin/societies

// ── Schools ───────────────────────────────────────────────────────────────
router.get("/schools", controller.getAllSchoolsAdmin);                              // GET  /api/v1/admin/schools
router.get("/schools/:id", controller.getSchoolAdminById);                         // GET  /api/v1/admin/schools/:id
router.post("/schools", handleUpload, controller.adminRegisterSchool);              // POST /api/v1/admin/schools

// ── ME dropdown ───────────────────────────────────────────────────────────
router.get("/me-list", controller.getMEList);                                      // GET  /api/v1/admin/me-list

// ── All students list (assigned + unassigned) ─────────────────────────────
router.get("/students", controller.listStudents);                              // GET /api/v1/admin/students?type=personal_tutor|individual_coaching

// ── Student assignment ─────────────────────────────────────────────────────
router.get("/students/unassigned", controller.getUnassignedStudents);         // GET  /api/v1/admin/students/unassigned?service=personal_tutor
router.get("/professionals/available", controller.getAvailableProfessionals); // GET  /api/v1/admin/professionals/available?type=teacher
router.post("/assign/teacher", controller.assignTeacher);                     // POST /api/v1/admin/assign/teacher
router.post("/assign/trainer", controller.assignTrainer);                     // POST /api/v1/admin/assign/trainer

// ── Fee structures ────────────────────────────────────────────────────────
router.get("/fee-structures/custom-categories", controller.listCustomFeeCategories); // GET  /api/v1/admin/fee-structures/custom-categories?type=society|school
router.get("/fee-structures", controller.listFeeStructures);               // GET  /api/v1/admin/fee-structures?section=school|society|individual_coaching|personal_tutor
router.post("/fee-structures", controller.upsertFeeStructure);             // POST /api/v1/admin/fee-structures
router.put("/fee-structures/:id", controller.upsertFeeStructure);          // PUT  /api/v1/admin/fee-structures/:id

// ── Payments ───────────────────────────────────────────────────────────────
// Filters: ?service_type=personal_tutor|individual_coaching|...  &status=captured|refunded|failed  &user_id=5  &from=&to=
router.get("/payments", controller.listPayments);                           // GET  /api/v1/admin/payments

// ── Commission rules (admin can view and edit rates) ──────────────────────
router.get("/commission-rules", controller.listCommissionRules);              // GET  /api/v1/admin/commission-rules
router.put("/commission-rules/:ruleKey", controller.updateCommissionRule);    // PUT  /api/v1/admin/commission-rules/trainer_personal_coaching_rate

// ── Commissions earned by professionals ───────────────────────────────────
// Filters: ?professional_type=trainer|teacher|marketing_executive  &status=pending|paid  &professional_id=5
router.get("/commissions", controller.listCommissions);                          // GET  /api/v1/admin/commissions
router.patch("/commissions/:id/approve", controller.approveCommission);          // PATCH /api/v1/admin/commissions/3/approve
router.patch("/commissions/:id/mark-paid", controller.markCommissionPaid);       // PATCH /api/v1/admin/commissions/3/mark-paid

// ── Withdrawal requests ────────────────────────────────────────────────────
router.get("/withdrawals", controller.listWithdrawalRequests);                               // GET   /api/v1/admin/withdrawals  — lists all professionals with requested status
router.patch("/withdrawals/:professionalId/approve", controller.approveWithdrawal);          // PATCH /api/v1/admin/withdrawals/5/approve

// ── Trainer travelling allowances ─────────────────────────────────────────
// Filters: ?trainer_professional_id=5  &status=pending|paid
router.get("/travelling-allowances", controller.listTravellingAllowances);              // GET  /api/v1/admin/travelling-allowances
router.patch("/travelling-allowances/:id/mark-paid", controller.markTravellingAllowancePaid); // PATCH /api/v1/admin/travelling-allowances/7/mark-paid

// ── Trainer/teacher assignments ───────────────────────────────────────────
// Filters: ?professional_id=5  &is_active=true|false
router.get("/assignments", controller.listTrainerAssignments);                              // GET   /api/v1/admin/assignments
router.patch("/assignments/:id/sessions-cap", controller.updateAssignmentSessionsCap);     // PATCH /api/v1/admin/assignments/3/sessions-cap  { sessions_allocated: 20 }
router.patch("/assignments/:id/deactivate", controller.deactivateAssignment);              // PATCH /api/v1/admin/assignments/3/deactivate

// ── Student assignment overview (assigned + unassigned, read-only) ─────────
// GET /api/v1/admin/student-assignments?service=personal_tutor|individual_coaching
router.get("/student-assignments", controller.listStudentAssignments);

// ── Sessions ──────────────────────────────────────────────────────────────
// GET  /api/v1/admin/sessions?type=personal_tutor|individual_coaching|group_coaching|school&from=&to=&professional_id=&status=
// POST /api/v1/admin/sessions  { session_type, date, start_time, end_time, student_ref_type, student_ref_id, professional_id }
router.get("/sessions", controller.listSessions);
router.post("/sessions", controller.createSession);

// GET /api/v1/admin/sessions/student-info?type=personal_tutor|individual_coaching&id=5
// Returns student details + subject/activity for session creation form
router.get("/sessions/student-info", controller.getSessionStudentInfo);

// ── Professionals for session creation (with busy/available flag) ─────────
// GET /api/v1/admin/professionals/for-session?type=teacher|trainer&date=&start_time=&end_time=&subject=&activity=
router.get("/professionals/for-session", controller.getProfessionalsForSession);

// ── Batches per society or school ─────────────────────────────────────────
router.get("/societies/:id/batches", controller.getSocietyBatches);   // GET /api/v1/admin/societies/1/batches
router.get("/schools/:id/batches", controller.getSchoolBatches);       // GET /api/v1/admin/schools/1/batches

// ── Settlement ────────────────────────────────────────────────────────────
router.get("/settlement/preview", controller.getSettlementPreview);                        // GET  /api/v1/admin/settlement/preview?professional_id=5 (optional)
router.post("/settlement/confirm", controller.confirmSettlement);                          // POST /api/v1/admin/settlement/confirm  { assignment_ids: [1,2,3] } (optional — omit to settle all)
router.get("/settlement/unsettled-count", controller.getUnsettledCount);                   // GET  /api/v1/admin/settlement/unsettled-count  (dashboard badge)

module.exports = router;
