const crypto = require("crypto");
const { verifyWebhookSignature } = require("../../utils/razorpay");
const paymentsRepo   = require("./paymentsrepo");
const icService      = require("../student/individualcoaching/indicoachservice");
const ptService      = require("../student/personaltutor/perstutorservice");
const ptAddonService = require("../student/subjectaddon/subjectaddonservice");
const ssService      = require("../student/school-student/schoolstudentservice");
const kitOrderService = require("../student/kitorder/kitorderservice");
const commissionRepo = require("../commissions/commissionrepo");

const SERVICE_MAP = {
    individual_coaching:   icService,
    group_coaching:        icService,
    personal_tutor:        ptService,
    personal_tutor_addon:  ptAddonService,
    school_student:        ssService,
    kit_order:             kitOrderService,
};

/**
 * Client-side payment verification — called by Flutter after the Razorpay SDK closes.
 *
 * Flutter sends: { temp_uuid, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * We verify the signature, look up the service_type from pending_registrations,
 * and finalize the registration immediately — no webhook needed.
 *
 * Signature formula (Razorpay spec):
 *   HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
 */
exports.verifyPayment = async (req, res) => {
    try {
        const { temp_uuid, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!temp_uuid || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing required payment fields" });
        }

        // Verify signature
        const expected = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const isValid = crypto.timingSafeEqual(
            Buffer.from(expected, "hex"),
            Buffer.from(razorpay_signature, "hex")
        );

        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        // Look up service_type from the pending registration
        const pending = await paymentsRepo.getPendingRegistration(temp_uuid);
        if (!pending) {
            return res.status(404).json({ success: false, message: "Registration not found for this temp_uuid" });
        }

        if (pending.status === "approved") {
            return res.status(200).json({ success: true, message: "Already finalized" });
        }

        const service = SERVICE_MAP[pending.service_type];
        if (!service) {
            return res.status(400).json({ success: false, message: `Unknown service_type: ${pending.service_type}` });
        }

        const formDataParsed = typeof pending.form_data === "string"
            ? JSON.parse(pending.form_data)
            : pending.form_data;
        const realAmount = formDataParsed?.calculated_amount ?? 0;

        await service.finalizeRegistration(temp_uuid, razorpay_payment_id, realAmount);
        return res.status(200).json({ success: true, message: "Payment verified and registration finalized" });
    } catch (error) {
        console.error("Payment verify error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DEV ONLY — Finalize any pending registration without going through Razorpay.
 * Only available when DEV_SKIP_PAYMENT=true in .env.
 *
 * POST /api/v1/payments/dev-finalize/:temp_uuid
 *
 * Usage (Postman / Flutter dev):
 *   1. POST to the registration endpoint → get back temp_uuid
 *   2. POST to this endpoint with that temp_uuid → registration finalized
 *   3. GET /status/:temp_uuid → get JWT
 */
exports.devFinalize = async (req, res) => {
    try {
        const { temp_uuid } = req.params;

        const pending = await paymentsRepo.getPendingRegistration(temp_uuid);
        if (!pending) {
            return res.status(404).json({ success: false, message: "No pending registration found for this temp_uuid" });
        }

        if (pending.status === "approved") {
            return res.status(200).json({ success: true, message: "Already finalized" });
        }

        const service = SERVICE_MAP[pending.service_type];
        if (!service) {
            return res.status(400).json({ success: false, message: `Unknown service_type: ${pending.service_type}` });
        }

        const formDataParsed = typeof pending.form_data === "string"
            ? JSON.parse(pending.form_data)
            : pending.form_data;
        const amount = formDataParsed?.calculated_amount ?? 0;

        await service.finalizeRegistration(temp_uuid, `dev_payment_${Date.now()}`, amount);

        return res.status(200).json({
            success: true,
            message: `[DEV] Registration finalized for service_type: ${pending.service_type}`,
            temp_uuid,
        });
    } catch (error) {
        console.error("[DEV] devFinalize error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Unified Razorpay webhook — handles payment.captured for all service types.
 *
 * Razorpay fires this for every payment. We read service_type from the order
 * notes (embedded at order-creation time) and route to the correct service.
 *
 * Configure a single webhook URL in the Razorpay Dashboard:
 *   POST /api/v1/payments/webhook
 */
exports.handlePaymentWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];

        if (!verifyWebhookSignature(req.rawBody, signature)) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        // Silently ack any event that isn't payment.captured
        if (req.body.event !== "payment.captured") {
            return res.status(200).json({ received: true });
        }

        const entity = req.body?.payload?.payment?.entity;
        const temp_uuid    = entity?.notes?.temp_uuid;
        const service_type = entity?.notes?.service_type;

        if (!temp_uuid) {
            console.error("Webhook missing temp_uuid in notes:", entity?.notes);
            return res.status(200).json({ received: true });
        }

        const service = SERVICE_MAP[service_type];
        if (!service) {
            console.error("Webhook received unknown service_type:", service_type);
            return res.status(200).json({ received: true });
        }

        const paymentId = entity.id;
        const amount    = entity.amount / 100; // paise → INR

        await service.finalizeRegistration(temp_uuid, paymentId, amount);
        return res.status(200).json({ success: true });

    } catch (error) {
        // Always return 200 so Razorpay stops retrying — log for manual review
        console.error("Unified webhook error:", error);
        return res.status(200).json({ received: true });
    }
};

/**
 * Razorpay Payouts webhook — handles payout.processed and payout.failed.
 * Configure a separate webhook URL in the Razorpay X Dashboard:
 *   POST /api/v1/payments/payout-webhook
 */
exports.handlePayoutWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        if (!verifyWebhookSignature(req.rawBody, signature)) {
            return res.status(400).json({ success: false, message: "Invalid webhook signature" });
        }

        const event    = req.body.event;
        const payoutId = req.body?.payload?.payout?.entity?.id;

        if (!payoutId) return res.status(200).json({ received: true });

        if (event === "payout.processed") {
            await commissionRepo.markPayoutPaid(payoutId);
            console.log(`[Payout] processed — payout_id: ${payoutId}`);
        } else if (event === "payout.failed" || event === "payout.reversed") {
            await commissionRepo.revertPayoutToApproved(payoutId);
            console.log(`[Payout] ${event} — reverted to approved — payout_id: ${payoutId}`);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error("Payout webhook error:", error);
        return res.status(200).json({ received: true });
    }
};
