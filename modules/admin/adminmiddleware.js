const jwt = require("jsonwebtoken");
const prisma = require("../../config/prisma");

const adminGuard = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authorization token required." });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        if (decoded.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied. Admins only." });
        }

        const adminRow = await prisma.admins.findFirst({
            where: { user_id: decoded.userId },
            select: { scope: true, users: { select: { id: true } } },
        });
        if (!adminRow) {
            return res.status(401).json({ success: false, message: "Admin record not found." });
        }

        req.admin = { ...decoded, scope: adminRow.scope };
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
};

// Only super_admin can pass this — place after adminGuard
const superAdminGuard = (req, res, next) => {
    if (req.admin?.scope !== "super_admin") {
        return res.status(403).json({ success: false, message: "Access denied. Super-admin only." });
    }
    next();
};

module.exports = adminGuard;
module.exports.superAdminGuard = superAdminGuard;
