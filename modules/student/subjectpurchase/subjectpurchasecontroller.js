const service = require("./subjectpurchaseservice");

/**
 * GET /student/subject-purchase/standards
 * Returns the list of standards that have personal_tutor fee rows.
 * Frontend uses this to populate the standard picker first.
 */
exports.getStandards = async (_req, res) => {
    try {
        const standards = await service.getStandards();
        return res.status(200).json({ success: true, standards });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

/**
 * GET /student/subject-purchase/subjects?standard=3RD-4TH
 * Returns subjects + fee tiers available for the given standard.
 * Frontend calls this after the student selects their standard.
 */
exports.getSubjectsForStandard = async (req, res) => {
    try {
        const subjects = await service.getSubjectsForStandard(req.query.standard, req.user.userId);
        return res.status(200).json({ success: true, subjects });
    } catch (err) {
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

/**
 * POST /student/subject-purchase/initiate
 * Phase 1: validates, computes total fee, creates Razorpay order, parks in pending_registrations.
 *
 * Body:
 *   standard        string    required  e.g. "3RD-4TH"
 *   activity_ids    number[]  required  subject activity IDs
 *   term_months     number    required
 *   preferred_time  string    optional
 *   batch           string    optional
 *
 * Response:
 *   { temp_uuid, razorpay_order_id, amount, currency, key_id }
 */
exports.initiateSubjectPurchase = async (req, res) => {
    try {
        const result = await service.initiateSubjectPurchase(req.user.userId, req.body);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        console.error("[SubjectPurchase] initiate error:", err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};

/**
 * POST /student/subject-purchase/:temp_uuid/dev-confirm
 * DEV ONLY — finalize without going through Razorpay.
 * Only available when DEV_SKIP_PAYMENT=true.
 */
exports.devConfirm = async (req, res) => {
    try {
        const result = await service.devFinalize(req.params.temp_uuid);
        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        console.error("[SubjectPurchase] devConfirm error:", err.message);
        return res.status(err.status || 500).json({ success: false, error: err.message });
    }
};
