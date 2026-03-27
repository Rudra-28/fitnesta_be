const express = require("express");
const router = express.Router();
const guard = require("./adminmiddleware");
const controller = require("./admincontroller");

router.use(guard); // every route below requires a valid admin JWT

router.get("/pending", controller.listPending);       // GET  /api/v1/admin/pending
router.get("/pending/:id", controller.listPending);   // GET  /api/v1/admin/pending?type=trainer
router.post("/approve/:id", controller.approve);      // POST /api/v1/admin/approve/5
router.post("/reject/:id", controller.reject);        // POST /api/v1/admin/reject/5

module.exports = router;
