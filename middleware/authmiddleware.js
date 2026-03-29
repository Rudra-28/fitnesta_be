// const jwt = require("jsonwebtoken");

// const SECRET = "supersecret";

// exports.verifyToken = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         message: "No token provided"
//       });
//     }

//     const token = authHeader.split(" ")[1];

//     const decoded = jwt.verify(token, SECRET);

//     req.user = decoded; // attach user info

//     next();

//   } catch (error) {
//     return res.status(401).json({
//       message: "Invalid token"
//     });
//   }
// };

// exports.authorizeRole = (role) => {
//   return (req, res, next) => {
//     if (req.user.role !== role) {
//       return res.status(403).json({
//         message: "Access denied"
//       });
//     }
//     next();
//   };
// };

const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

// 1. Verify JWT (For logged-in users)
const verifyAccessToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access token missing or malformed" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await prisma.users.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
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