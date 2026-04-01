const express = require("express");
const router = express.Router();
const societyController = require("./societycontroller");
const adminGuard = require("../../admin/adminmiddleware");

// Public / student routes
router.post("/", societyController.registerSociety);
router.get("/", societyController.getSocieties);

// Admin — society_request
router.get("/admin/requests/pending",          adminGuard, societyController.listPendingRequests);
router.post("/admin/requests/:id/assign-me",   adminGuard, societyController.assignMeToRequest);
router.post("/admin/requests/approve/:id",     adminGuard, societyController.approveRequest);
router.post("/admin/requests/reject/:id",      adminGuard, societyController.rejectRequest);

// Admin — ME list (for picking an ME to assign)
router.get("/admin/me-list",                   adminGuard, societyController.listMEs);

module.exports = router;
