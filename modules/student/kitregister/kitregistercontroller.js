const crypto = require("crypto");
const jwt    = require("jsonwebtoken");
const prisma = require("../../../config/prisma");

/**
 * POST /api/v1/student-dashboard/quick-register
 *
 * Mini registration for kit buyers — no OTP, no activity enrollment.
 * Creates a users row and returns a JWT so they can immediately place a kit order.
 * If mobile already exists, returns a JWT for that existing account (idempotent).
 *
 * Body: { fullName, mobile, city }
 */
exports.quickRegister = async (req, res) => {
    try {
        const { fullName, mobile } = req.body;

        if (!fullName) return res.status(400).json({ success: false, error: "fullName is required." });
        if (!mobile)   return res.status(400).json({ success: false, error: "mobile is required." });

        const cleanMobile = mobile.replace("+91", "").trim();

        // Idempotent — if mobile already exists, just return a JWT for that user
        let user = await prisma.users.findUnique({ where: { mobile: cleanMobile } });

        if (!user) {
            user = await prisma.users.create({
                data: {
                    uuid:            crypto.randomUUID(),
                    role:            "student",
                    full_name:       fullName,
                    mobile:          cleanMobile,
                    approval_status: "approved",
                    is_verified:     false,  // marked true on first login
                },
            });
        }

        // Block suspended accounts
        if (user.is_suspended) {
            return res.status(403).json({ success: false, error: "ACCOUNT_SUSPENDED" });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                mobile: user.mobile,
                role:   "student",
            },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(201).json({
            success: true,
            message: user.created_at ? "Registered successfully." : "Account already exists, logged in.",
            data: {
                token,
                user: {
                    id:       user.id,
                    name:     user.full_name,
                    mobile:   user.mobile,
                    role:     "student",
                },
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
