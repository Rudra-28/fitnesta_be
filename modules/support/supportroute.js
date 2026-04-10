const express = require("express");
const router = express.Router();
const { verifyAccessToken } = require("../../middleware/authmiddleware");
const controller = require("./supportcontroller");

// POST /api/v1/support  — any logged-in user submits a help/support message
router.post("/", verifyAccessToken, controller.submitTicket);

// GET /api/v1/support/legal?dashboard_type=student&content_type=privacy_and_policy
// GET /api/v1/support/legal?dashboard_type=trainer&content_type=terms_and_conditions
// No auth required — public endpoint for frontend to fetch T&C and Privacy Policy
router.get("/legal", controller.getLegalContent);

module.exports = router;
