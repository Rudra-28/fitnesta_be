const express = require("express");
const router = express.Router();
const guard = require("./adminmiddleware");
const { superAdminGuard } = require("./adminmiddleware");
const controller = require("./admincontroller");
const sessionController = require("./session/sessioncontroller");
const upload = require("../../utils/fileupload");
const { uploadActivityImage } = require("../../utils/fileupload");

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

// ── Audit logs ────────────────────────────────────────────────────────────
// GET /api/v1/admin/audit-logs?admin_user_id=&action=&from=&to=&limit=&offset=
router.get("/audit-logs", controller.getAuditLogs);

// ── Sub-admin management (super_admin only) ───────────────────────────────
router.get("/sub-admins", superAdminGuard, controller.listAdmins);                        // GET    /api/v1/admin/sub-admins
router.post("/sub-admins", superAdminGuard, controller.createSubAdmin);                   // POST   /api/v1/admin/sub-admins
router.delete("/sub-admins/:userId", superAdminGuard, controller.removeSubAdmin);         // DELETE /api/v1/admin/sub-admins/:userId

router.get("/pending", controller.listPending);                            // GET  /api/v1/admin/pending?type=trainer
router.get("/pending/:id", controller.listPending);                        // GET  /api/v1/admin/pending/:id
router.post("/approve/:id", controller.approve);                           // POST /api/v1/admin/approve/5
router.post("/reject/:id", controller.reject);                             // POST /api/v1/admin/reject/5

// ── Approved professionals list ───────────────────────────────────────────
router.get("/professionals", controller.listProfessionals);                // GET /api/v1/admin/professionals?type=trainer
router.get("/activities/:activityId/professionals", controller.getProfessionalsByActivity); // GET /api/v1/admin/activities/:activityId/professionals?type=trainer|teacher

// ── Activities ────────────────────────────────────────────────────────────
router.get("/activities",      controller.listActivities);                                                         // GET    /api/v1/admin/activities?coaching_type=group_coaching
router.post("/activities",     superAdminGuard, uploadActivityImage.single("image"), controller.createActivity);  // POST   /api/v1/admin/activities
router.put("/activities/:id",  superAdminGuard, uploadActivityImage.single("image"), controller.updateActivity);  // PUT    /api/v1/admin/activities/:id
router.delete("/activities/:id", superAdminGuard, controller.deleteActivity);                                     // DELETE /api/v1/admin/activities/:id?force=true

// ── Societies ─────────────────────────────────────────────────────────────
router.get("/societies", controller.getAllSocietiesAdmin);                          // GET  /api/v1/admin/societies
router.get("/societies/approved", controller.getApprovedSocieties);                 // GET  /api/v1/admin/societies/approved (for batch creation)
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
router.get("/students/group-coaching", controller.getGroupCoachingStudentsForBatch); // GET  /api/v1/admin/students/group-coaching?batch_id=&society_id=&activity_id=
router.get("/students/school-batch", controller.getSchoolStudentsForBatch);          // GET  /api/v1/admin/students/school-batch?batch_id=&school_id=&activity_id=
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

// ── Pay-ins / Pay-outs ─────────────────────────────────────────────────────
// GET /api/v1/admin/payments/pay-ins   ?service_type=&from=&to=
// GET /api/v1/admin/payments/pay-outs  ?professional_type=&commission_status=&refund_status=&from=&to=
// PATCH /api/v1/admin/payments/refunds/:id/mark-processed
router.get("/payments/pay-ins",  controller.listPayIns);
router.get("/payments/pay-outs", controller.listPayOuts);
router.patch("/payments/refunds/:id/mark-processed", controller.markRefundProcessed);

// ── Commission rules (admin can view and edit rates) ──────────────────────
router.get("/commission-rules", controller.listCommissionRules);              // GET  /api/v1/admin/commission-rules
router.put("/commission-rules/:ruleKey", controller.updateCommissionRule);    // PUT  /api/v1/admin/commission-rules/trainer_personal_coaching_rate

// ── Commissions earned by professionals ───────────────────────────────────
// Filters: ?professional_type=trainer|teacher|marketing_executive  &status=pending|paid  &professional_id=5
router.get("/commissions", controller.listCommissions);                          // GET  /api/v1/admin/commissions
router.patch("/commissions/:id/approve", controller.approveCommission);          // PATCH /api/v1/admin/commissions/3/approve
router.patch("/commissions/:id/mark-paid", controller.markCommissionPaid);       // PATCH /api/v1/admin/commissions/3/mark-paid



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

// ── Personal tutor session creation — student subjects + teachers ─────────
// GET /api/v1/admin/students/:studentId/subjects
// GET /api/v1/admin/students/:studentId/subjects/:activityId/teachers?date=&start_time=&end_time=
router.get("/students/:studentId/subjects", controller.getStudentSubjects);
router.get("/students/:studentId/subjects/:activityId/teachers", controller.getTeachersForSubject);

// ── Individual coaching session creation — student activities + trainers ──
// GET /api/v1/admin/students/:studentId/activities
// GET /api/v1/admin/students/:studentId/activities/:activityId/trainers?date=&start_time=&end_time=
router.get("/students/:studentId/activities", controller.getStudentActivities);
router.get("/students/:studentId/activities/:activityId/trainers", controller.getTrainersForActivity);
router.get("/students/:studentId/session-batches", sessionController.getStudentSessionBatches); // GET /api/v1/admin/students/:studentId/session-batches

// ── Batches per society or school ─────────────────────────────────────────
router.get("/societies/:id/batches", controller.getSocietyBatches);   // GET /api/v1/admin/societies/1/batches
router.get("/schools/:id/batches", controller.getSchoolBatches);       // GET /api/v1/admin/schools/1/batches

// ── Support tickets ───────────────────────────────────────────────────────
router.get("/support-tickets", controller.listSupportTickets);                        // GET   /api/v1/admin/support-tickets?status=open|resolved
router.patch("/support-tickets/:id/resolve", controller.resolveSupportTicket);        // PATCH /api/v1/admin/support-tickets/3/resolve

// ── Legal content (T&C and Privacy Policy per dashboard) ─────────────────
// dashboard_type: trainer | teacher | marketing_executive | vendor | student
// content_type:   terms_and_conditions | privacy_and_policy
router.post("/legal", controller.upsertLegalContent);                      // POST /api/v1/admin/legal
router.get("/legal", controller.getLegalContent);                          // GET  /api/v1/admin/legal?dashboard_type=&content_type=

// ── Settlement ────────────────────────────────────────────────────────────
router.get("/settlement/preview", controller.getSettlementPreview);                        // GET  /api/v1/admin/settlement/preview?professional_id=5 (optional)
router.post("/settlement/confirm", controller.confirmSettlement);                          // POST /api/v1/admin/settlement/confirm  { assignment_ids: [1,2,3] } (optional — omit to settle all)
router.get("/settlement/unsettled-count", controller.getUnsettledCount);                   // GET  /api/v1/admin/settlement/unsettled-count  (dashboard badge)

// ── Per-professional "Sessions & Settle" tab  ─────────────────────────────
// GET  /api/v1/admin/professionals/:professionalId/settlement-preview
//   → Returns group-coaching batches + individual students with trainer_earns amount.
// POST /api/v1/admin/professionals/:professionalId/settle
//   → "Settle Amount" button: creates commission records at status=pending.
//      Body (all optional): { assignment_ids: [1,2], cap_overrides: { "5": 15 } }
router.get("/professionals/:professionalId/settlement-preview", controller.getSessionsAndSettlePreview);
router.post("/professionals/:professionalId/settle", controller.settleAmountForProfessional);

// ── Enriched Sessions & Settle (trainer / teacher) ────────────────────────
// GET  /api/v1/admin/professionals/:professionalId/sessions-settle
//   → Full session breakdown: batch info, completed/upcoming/absent counts, trainer_earns.
router.get("/professionals/:professionalId/sessions-settle", controller.getSessionsSettle);

// ── Professional Payouts tab ──────────────────────────────────────────────
// GET /api/v1/admin/professionals/:professionalId/payouts
//   → All commission records for this professional (pending_payout total + list).
router.get("/professionals/:professionalId/payouts", controller.getProfessionalPayouts);

// ── ME Settlement ─────────────────────────────────────────────────────────
// GET  /api/v1/admin/professionals/:professionalId/me-settlement-preview
//   → All societies with activity count and student count.
// GET  /api/v1/admin/professionals/:professionalId/me-societies/:societyId/describe
//   → Student breakdown for "Describe Settlement" modal.
// POST /api/v1/admin/professionals/:professionalId/me-societies/:societyId/settle
//   → Settle ME commission for a society (validates 20-student threshold).
router.get("/professionals/:professionalId/me-settlement-preview", controller.getMESettlementPreview);
router.get("/professionals/:professionalId/me-societies/:societyId/describe", controller.getMESettlementDescribe);
router.post("/professionals/:professionalId/me-societies/:societyId/settle", controller.settleMECommission);

// ── Vendor panel ──────────────────────────────────────────────────────────
// GET  /api/v1/admin/professionals/:professionalId/vendor-panel
//   → Listed products + recent orders with base/transport/profit-share breakup.
// POST /api/v1/admin/professionals/:professionalId/vendor-orders/:orderId/settle
//   → Move a kit order's commission to pending payout.
router.get("/professionals/:professionalId/vendor-panel", controller.getVendorPanel);
router.post("/professionals/:professionalId/vendor-orders/:orderId/settle", controller.settleVendorOrder);

// ── Visiting Forms ────────────────────────────────────────────────────────────
// GET /api/v1/admin/visiting-forms?meId=&placeType=society|school|organisation&permissionStatus=granted|not_granted|follow_up&from=&to=&page=&limit=
router.get("/visiting-forms", controller.listVisitingForms);
router.get("/visiting-forms/:id", controller.getVisitingFormByIdAdmin);

// ── User management (super_admin only) ───────────────────────────────────
// GET    /api/v1/admin/users?role=&subrole=&search=&limit=&offset=
// GET    /api/v1/admin/users/:userId
// PATCH  /api/v1/admin/users/:userId          { full_name, email, address, photo, mobile }
// PATCH  /api/v1/admin/users/:userId/suspend  { note? }
// PATCH  /api/v1/admin/users/:userId/unsuspend
router.get("/users",                        superAdminGuard, controller.listUsers);
router.get("/users/:userId",                superAdminGuard, controller.getUser);
router.patch("/users/:userId",              superAdminGuard, controller.editUser);
router.patch("/users/:userId/suspend",      superAdminGuard, controller.suspendUser);
router.patch("/users/:userId/unsuspend",    superAdminGuard, controller.unsuspendUser);

module.exports = router;
