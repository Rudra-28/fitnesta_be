const express = require("express");
const router = express.Router();
const { verifyAccessToken } = require("../../middleware/authmiddleware");
const controller = require("./supportcontroller");

// POST /api/v1/support  — any logged-in user submits a help/support message
router.post("/", verifyAccessToken, controller.submitTicket);

module.exports = router;
