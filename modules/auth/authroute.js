const express = require("express");
const router = express.Router();
const controller = require("./authcontroller");
const { verifyAccessToken } = require("../../middleware/authmiddleware");

router.post("/login", controller.login);
router.get("/me", verifyAccessToken, controller.getMe);

module.exports = router;