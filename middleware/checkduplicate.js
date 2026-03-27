const db = require("../config/db");

exports.verifyMobileUnique = async (req, res, next) => {
    try {
        const mobile = req.body?.authorityContact || req.body?.contactNumber || req.body?.mobile;

        if (!mobile) {
            return res.status(400).json({ success: false, message: "Mobile number is required." });
        }

        // Check 1: already an approved user
        const [users] = await db.execute(
            `SELECT id FROM users WHERE mobile = ? LIMIT 1`,
            [mobile]
        );
        if (users.length > 0) {
            return res.status(400).json({
                success: false,
                message: "This mobile number is already registered. Please login or use another number."
            });
        }

        // Check 2: already has a pending submission
        const [pending] = await db.execute(
            `SELECT id FROM pending_registrations
             WHERE JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.contactNumber')) = ?
             AND status = 'pending'
             LIMIT 1`,
            [mobile]
        );
        if (pending.length > 0) {
            return res.status(400).json({
                success: false,
                message: "A registration request with this mobile number is already pending admin approval."
            });
        }

        next();
    } catch (error) {
        console.error("Duplicate check error:", error);
        res.status(500).json({ success: false, message: "Internal server error during validation." });
    }
};
