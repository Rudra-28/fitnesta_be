const service = require("./schoolstudentservice");
const jwt = require("jsonwebtoken");
const { verifyWebhookSignature } = require("../../../utils/razorpay");
const { validateSchoolStudent } = require("./schoolstudentvalidation");
const schoolRepo = require("../../school/schoolrepo");

/**
 * PHASE 1 — Flutter submits the school student enrollment form.
 *
 * Extra field required (on top of existing form fields):
 *   activity_id  {number}  — selected activity's ID from the activities list
 *                            (term is always 9 months, no need to send term_months)
 *
 * Response: { success, temp_uuid, order_id, amount, currency, key_id }
 */
exports.submitRegistration = async (req, res) => {
    try {
        const formData = req.body;
        const serviceType = "school_student";

        const errors = validateSchoolStudent(formData);
        if (errors.length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        const school = await schoolRepo.getSchoolByName(formData.schoolName);
        if (!school) {
            return res.status(404).json({ success: false, message: "Selected school does not exist in our system." });
        }
        formData.school_id = school.id;

        // Attach payment info so the service can look up the fee
        formData.payment = {
            activity_id: formData.activity_id ? parseInt(formData.activity_id) : null,
        };

        const result = await service.initiateRegistration(formData, serviceType);

        return res.status(200).json({
            success: true,
            message: "Registration parked. Complete payment to confirm.",
            temp_uuid: result.tempUuid,
            order_id: result.orderId,
            amount: result.amount,
            currency: result.currency,
            key_id: result.keyId,
        });
    } catch (error) {
        return res.status(error.status ?? 500).json({ success: false, message: error.message });
    }
};

/**
 * PHASE 2 — Razorpay webhook (payment.captured event).
 */
exports.handlePaymentWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];

        if (!verifyWebhookSignature(req.rawBody, signature)) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        const entity = req.body?.payload?.payment?.entity;
        const temp_uuid = entity?.notes?.temp_uuid;

        if (!temp_uuid) {
            return res.status(400).json({ success: false, message: "temp_uuid missing from payment notes" });
        }

        if (req.body.event !== "payment.captured") {
            return res.status(200).json({ received: true });
        }

        await service.finalizeRegistration(temp_uuid);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("SS Webhook error:", error);
        return res.status(200).json({ received: true });
    }
};

/**
 * PHASE 3 — Flutter polls this after the Razorpay SDK closes.
 */
exports.checkRegistrationStatus = async (req, res) => {
    try {
        const { temp_uuid } = req.params;
        const registration = await service.getRegistrationStatus(temp_uuid);

        if (registration.status === "approved") {
            const token = jwt.sign(
                { id: registration.userId, role: "student" },
                process.env.JWT_ACCESS_SECRET,
                { expiresIn: "7d" }
            );
            return res.status(200).json({
                success: true,
                isCompleted: true,
                token,
                userId: registration.userId,
            });
        }

        return res.status(200).json({ success: true, isCompleted: false, status: registration.status });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
