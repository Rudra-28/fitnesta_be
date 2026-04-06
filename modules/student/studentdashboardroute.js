const express = require("express"); 
const router = express.Router();
const vendorController = require("../professionals/vendor/vendordashboard/vendordashboardcontroller");
const kitOrderController = require("./kitorder/kitordercontroller");
const studentGuard = require("./studentmiddleware");
const ctrl = require("./studentdashboardcontroller"); 

// ── Products (Kits) — public ───────────────────────────────────────────────
router.get("/products", vendorController.getAllProductsPublic);
router.get("/products/:id", vendorController.getProductByIdPublic);

// ── Kit Orders ─────────────────────────────────────────────────────────────
router.post("/orders", studentGuard, kitOrderController.initiateKitOrder);
router.get("/orders", studentGuard, kitOrderController.getMyOrders);
router.get("/orders/:order_id", studentGuard, kitOrderController.getMyOrderById);
if (process.env.DEV_SKIP_PAYMENT === "true") {
  router.post("/orders/:temp_uuid/dev-confirm", studentGuard, kitOrderController.devFinalizeKitOrder);
}

// ── Subjects (personal_tutor) ──────────────────────────────────────────────
router.get("/subjects/stats",                studentGuard, ctrl.getSubjectsDashboardStats);
router.get("/subjects",                      studentGuard, ctrl.getSubjectsWithSessions);
router.get("/subjects/reminder",             studentGuard, ctrl.getSubjectsReminder);
router.get("/subjects/sessions",             studentGuard, ctrl.getSubjectsSessions);
router.get("/subjects/sessions/:sessionId",  studentGuard, ctrl.getSubjectsSessionById);

// ── Activities (individual_coaching / group_coaching) ──────────────────────
router.get("/activities/stats",               studentGuard, ctrl.getActivitiesDashboardStats);
router.get("/activities",                     studentGuard, ctrl.getActivitiesWithSessions);
router.get("/activities/reminder",            studentGuard, ctrl.getActivitiesReminder);
router.get("/activities/sessions",            studentGuard, ctrl.getActivitiesSessions);
router.get("/activities/sessions/:sessionId", studentGuard, ctrl.getActivitiesSessionById);

// ── Feedback ───────────────────────────────────────────────────────────────
router.post("/sessions/:id/feedback", studentGuard, ctrl.submitFeedback);

module.exports = router;
