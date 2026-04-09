const service = require("./activitypurchaseservice");

/**
 * GET /student/activity-purchase/societies
 * Returns all approved societies for the group coaching dropdown.
 */
exports.getSocieties = async (req, res) => {
    try {
        const societies = await service.getApprovedSocieties();
        return res.status(200).json({ success: true, societies });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

/**
 * GET /student/activity-purchase/schools
 * Returns all approved schools for the school coaching dropdown.
 */
exports.getSchools = async (req, res) => {
    try {
        const schools = await service.getApprovedSchools();
        return res.status(200).json({ success: true, schools });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

/**
 * GET /student/activity-purchase/fees
 * Returns available activities + fee tiers for the chosen purchase type.
 *
 * Query params:
 *   type        = individual | group | school
 *   society_id  = (required when type=group)
 *   school_id   = (required when type=school)
 *   term_months = optional; omit to get all term options
 */
exports.getFees = async (req, res) => {
    try {
        const { type, society_id, school_id, term_months } = req.query;
        const activities = await service.getAvailableActivities({ type, society_id, school_id, term_months });
        return res.status(200).json({ success: true, activities });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

/**
 * POST /student/activity-purchase/initiate
 * Phase 1: validates, computes total, creates Razorpay order, parks in pending_registrations.
 *
 * Body:
 *   type            string   "individual" | "group" | "school"
 *   activity_ids    number[]
 *   term_months     number
 *   society_id      number   required for group
 *   society_name    string   free-text for individual, optional label for group
 *   school_id       number   required for school
 *   flat_no         string   optional
 *   preferred_batch string   optional
 *   student_name    string   optional (school)
 *   standard        string   optional (school)
 *   kit_type        string   optional
 *
 * Response:
 *   { temp_uuid, razorpay_order_id, amount, currency, key_id }
 */
exports.initiateActivityPurchase = async (req, res) => {
    try {
        const result = await service.initiateActivityPurchase(req.user.userId, req.body);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("[ActivityPurchase] initiate error:", err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

/**
 * POST /student/activity-purchase/:temp_uuid/dev-confirm
 * DEV ONLY — skip Razorpay and finalize immediately.
 * Only available when DEV_SKIP_PAYMENT=true.
 */
exports.devConfirm = async (req, res) => {
    try {
        const result = await service.devFinalize(req.params.temp_uuid);
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        console.error("[ActivityPurchase] devConfirm error:", err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};
