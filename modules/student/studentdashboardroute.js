const express = require("express");
const router = express.Router();
const vendorController = require("../professionals/vendor/vendordashboard/vendordashboardcontroller");
const kitOrderController = require("./kitorder/kitordercontroller");
const activityPurchaseCtrl = require("./activitypurchase/activitypurchasecontroller");
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

// ── Edit profile ───────────────────────────────────────────────────────────
router.patch("/edit-profile", studentGuard, ctrl.editProfile);               // PATCH /api/v1/student-dashboard/edit-profile

// ── Toggle state ───────────────────────────────────────────────────────────
router.get("/toggle", studentGuard, ctrl.getToggleState);

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

// ── Subject Addon (buy a new subject) ─────────────────────────────────────
router.get("/subjects/available",                studentGuard, ctrl.getAvailableSubjects);
router.post("/subjects/buy",                     studentGuard, ctrl.initiateSubjectAddon);

// ── Activity Purchase (buy a sport activity for existing student) ──────────
router.get("/activity-purchase/societies",       studentGuard, activityPurchaseCtrl.getSocieties);
router.get("/activity-purchase/schools",         studentGuard, activityPurchaseCtrl.getSchools);
router.get("/activity-purchase/fees",            studentGuard, activityPurchaseCtrl.getFees);
router.post("/activity-purchase/initiate",       studentGuard, activityPurchaseCtrl.initiateActivityPurchase);
if (process.env.DEV_SKIP_PAYMENT === "true") {
  router.post("/activity-purchase/:temp_uuid/dev-confirm", studentGuard, activityPurchaseCtrl.devConfirm);
}

// ── Feedback ───────────────────────────────────────────────────────────────
router.post("/sessions/:id/feedback", studentGuard, ctrl.submitFeedback);

module.exports = router;
