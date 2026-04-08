const express = require('express');
const router = express.Router();

const societyRoutes = require("../../modules/student/society/societyroute");
const individualCoaching = require('../../modules/student/individualcoaching/indicoachroute')
const otherarea = require('../../modules/student/Other_Area/otherarearoute')
router.use('/auth', require('../../modules/auth/authroute'));
router.use('/trainers', require('../../modules/professionals/trainer/trainerroute'));
router.use('/teachers', require('../../modules/professionals/teacher/teacherroute'));
router.use('/vendors', require('../../modules/professionals/vendor/vendorroute'));
router.use('/vendor-dashboard', require('../../modules/professionals/vendor/vendordashboard/vendordashboardroute'));
router.use('/teacher-dashboard', require('../../modules/professionals/teacher/teacherdashboard/teacherdashboardroute'));
router.use('/student-dashboard', require('../../modules/student/studentdashboardroute'));
router.use('/marketing-executives', require('../../modules/professionals/marketingExe/Registration-form/marketexeroute'));
router.use('/personal-tutor', require('../../modules/student/personaltutor/perstutorroute'));
router.use('/individual-coaching', individualCoaching);
router.use('/group-coaching', individualCoaching);
router.use("/society", societyRoutes);
router.use("/other-area", otherarea);
router.use("/school", require('../../modules/school/schoolroute'));
router.use("/school-student", require('../../modules/student/school-student/schoolstudentroute'));
router.use("/admin/batches", require('../../modules/admin/batch/batchroute'));
router.use("/admin/sessions", require('../../modules/admin/session/sessionroute'));
router.use("/admin", require('../../modules/admin/adminroute'));
router.use("/me-dashboard", require('../../modules/professionals/marketingExe/dashboard/medashboardroute'));
router.use("/trainer-dashboard", require('../../modules/professionals/trainer/trainerdashboard/trainerdashboardroute'));
router.use("/activities", require('../../modules/activities/activitiesroute'));
router.use("/payments", require('../../modules/payments/paymentsroute'));
router.use("/notifications", require('../../modules/notifications/notificationsroute'));

module.exports = router;