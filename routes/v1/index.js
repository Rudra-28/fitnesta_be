const express = require('express');
const router = express.Router();

const societyRoutes = require("../../modules/student/society/societyroute");
const individualCoaching = require('../../modules/student/individualcoaching/indicoachroute')
const otherarea = require('../../modules/student/Other_Area/otherarearoute')
router.use('/auth', require('../../modules/auth/authroute'));
router.use('/trainers', require('../../modules/professionals/trainer/trainerroute'));
router.use('/teachers', require('../../modules/professionals/teacher/teacherroute'));
router.use('/vendors', require('../../modules/professionals/vendor/vendorroute'));
router.use('/marketing-executives', require('../../modules/professionals/marketingExe/marketexeroute'));
router.use('/personal-tutor', require('../../modules/student/personaltutor/perstutorroute'));
router.use('/individual-coaching', individualCoaching);
router.use("/society", societyRoutes);
router.use("/other-area", otherarea);
router.use("/school", require('../../modules/school/schoolroute'));
router.use("/school-student", require('../../modules/student/school-student/schoolstudentroute'));

module.exports = router;