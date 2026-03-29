const express = require("express");
const router = express.Router();

router.use("/", require("./vendorregistration/vendorroute"));
router.use("/dashboard", require("./vendordashboard/vendordashboardroute"));

module.exports = router;
