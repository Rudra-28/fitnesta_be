const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

// 1. Verify JWT (For logged-in users)
const verifyAccessToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access token missing or malformed" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Normalise: old registration tokens used "id", login tokens use "userId"
    if (decoded.userId === undefined && decoded.id !== undefined) {
      decoded.userId = decoded.id;
    }

    const user = await prisma.users.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// 2. Verify App Secret (For pre-registration/guest access)
const verifyAppSecret = (req, res, next) => {
  const appSecret = req.headers['x-app-secret'];
  const VALID_SECRET = process.env.FLUTTER_APP_SECRET;

  if (!appSecret || appSecret !== VALID_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized App Access" });
  }
  next();
};

// EXPORT BOTH HERE
module.exports = {
  verifyAccessToken,
  verifyAppSecret
};