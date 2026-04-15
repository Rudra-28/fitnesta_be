const crypto = require("crypto");
const { verifyWebhookSignature } = require("../../utils/razorpay");
const { sendNotification } = require("../../utils/fcm");
const paymentsRepo    = require("./paymentsrepo");
const paymentsService = require("./paymentsservice");
const { streamReceiptPDF } = require("./receiptpdf");
const icService              = require("../student/individualcoaching/indicoachservice");
const ptService              = require("../student/personaltutor/perstutorservice");
const ptAddonService         = require("../student/subjectaddon/subjectaddonservice");
const ssService              = require("../student/school-student/schoolstudentservice");
const kitOrderService        = require("../student/kitorder/kitorderservice");
const activityPurchaseService = require("../student/activitypurchase/activitypurchaseservice");
const subjectPurchaseService  = require("../student/subjectpurchase/subjectpurchaseservice");
const commissionRepo         = require("../commissions/commissionrepo");

const SERVICE_MAP = {
    individual_coaching:             icService,
    group_coaching:                  icService,
    personal_tutor:                  ptService,
    personal_tutor_addon:            ptAddonService,
    school_student:                  ssService,
    kit_order:                       kitOrderService,
    activity_purchase_individual:    activityPurchaseService,
    activity_purchase_group:         activityPurchaseService,
    activity_purchase_school:        activityPurchaseService,
    subject_purchase:                subjectPurchaseService,
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

        const { userId } = await service.finalizeRegistration(temp_uuid, razorpay_payment_id, realAmount);

        let receipt = null;
        try {
            receipt = await paymentsService.getReceipt(temp_uuid, userId);
        } catch (_) { /* non-fatal — Flutter can fetch via GET /receipt/:temp_uuid */ }

        if (userId) {
            let notificationBody = "Your registration is confirmed.";
            
            try {
                const activityIds = formDataParsed?.payment?.activity_ids;
                const termMonths = formDataParsed?.payment?.term_months;
                
                if (activityIds && Array.isArray(activityIds) && activityIds.length > 0 && termMonths) {
                    const prisma = require("../../config/prisma");
                    const activities = await prisma.activities.findMany({
                        where: { id: { in: activityIds.map(Number) } },
                        select: { name: true }
                    });
                    
                    if (activities.length > 0) {
                        const activityNames = activities.map(a => a.name).join(", ");
                        notificationBody = `You are now part of the ${activityNames} activity for ${termMonths} months.`;
                    }
                }
            } catch(e) {
                console.error("Failed to personalize payment notification:", e.message);
            }

            const fcmToken = formDataParsed?.fcmToken || formDataParsed?.fcm_token || null;
            if (fcmToken) {
                const { sendNotificationToToken } = require("../../utils/fcm");
                sendNotificationToToken(fcmToken, "Payment Successful", notificationBody, { type: "payment_confirmed", temp_uuid });
            } else {
                sendNotification(userId, "Payment Successful", notificationBody, { type: "payment_confirmed", temp_uuid });
            }
        }

        return res.status(200).json({ success: true, message: "Payment verified and registration finalized", receipt });
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
 * GET /api/v1/payments/receipts
 * List all receipts for the logged-in student (auth required).
 */
exports.listReceipts = async (req, res) => {
    try {
        const receipts = await paymentsService.listReceipts(req.user.userId);
        return res.status(200).json({ success: true, receipts });
    } catch (error) {
        console.error("listReceipts error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/payments/receipt/:temp_uuid
 * Fetch a single receipt for the logged-in student (auth required).
 */
exports.getReceipt = async (req, res) => {
    try {
        const receipt = await paymentsService.getReceipt(req.params.temp_uuid, req.user.userId);
        return res.status(200).json({ success: true, receipt });
    } catch (error) {
        const status = error.status || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/payments/receipt/:temp_uuid/pdf
 * Stream a PDF receipt for the logged-in student.
 */
exports.downloadReceiptPDF = async (req, res) => {
    try {
        const receipt = await paymentsService.getReceipt(req.params.temp_uuid, req.user.userId);
        streamReceiptPDF(receipt, res);
    } catch (error) {
        const status = error.status || 500;
        return res.status(status).json({ success: false, message: error.message });
    }
};


