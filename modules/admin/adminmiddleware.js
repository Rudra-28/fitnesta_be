const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "Authorization token required." });
    }

    try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        if (!["admin", "sub_admin"].includes(decoded.role)) {
            return res.status(403).json({ success: false, message: "Access denied. Admins only." });
        }

        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
};
