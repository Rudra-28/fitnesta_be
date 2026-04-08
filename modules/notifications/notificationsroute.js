const express    = require("express");
const router     = express.Router();
const prisma     = require("../../config/prisma");
const { verifyAccessToken } = require("../../middleware/authmiddleware");

/**
 * POST /api/v1/notifications/register-token
 *
 * Flutter calls this after login (or whenever the FCM token refreshes).
 * Body: { fcm_token: "<device token>" }
 *
 * Auth required — we read userId from the JWT.
 */
router.post("/register-token", verifyAccessToken, async (req, res) => {
    try {
        const { fcm_token } = req.body;
        if (!fcm_token) {
            return res.status(400).json({ success: false, message: "fcm_token is required" });
        }

        await prisma.users.update({
            where: { id: req.user.userId },
            data:  { fcm_token },
        });

        return res.json({ success: true, message: "FCM token registered" });
    } catch (err) {
        console.error("[Notifications] register-token error:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
