const express = require("express");
const router = express.Router();


const societyController = require("./societycontroller");

// Middlewares (if you have them)
const { verifyMobileUnique } = require("../../../middleware/checkduplicate");

// 🚀 Register Society
router.post(
  "/",         // ensures only your app hits API
  verifyMobileUnique,    // optional (recommended later)
  societyController.registerSociety
);

// Fetch societies list
router.get("/", societyController.getSocieties);

module.exports = router;