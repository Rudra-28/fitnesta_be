const prisma = require("../../../config/prisma");
const crypto = require("crypto");
const repo = require("./indicoachrepo");
const activitiesRepo = require("../../activities/activitiesrepository");
const razorpay = require("../../../utils/razorpay");

/**
 * PHASE 1 — Park form data and create a Razorpay order.
 *
 * The controller must include formData.payment = { activity_id, term_months, coaching_type }
 * where coaching_type is 'individual_coaching' (1-on-1) or 'group_coaching' (society participant).
 *
 * Returns: { tempUuid, orderId, amount, currency, keyId }
 * The controller passes orderId + keyId back to Flutter so it can open the Razorpay SDK.
 */
exports.initiateRegistration = async (formData, serviceType) => {
    const { activity_id, term_months, coaching_type } = formData.payment || {};

    if (!activity_id || !term_months) {
        const err = new Error("activity_id and term_months are required to calculate the fee");
        err.status = 400;
        throw err;
    }

    const coachingType = coaching_type || serviceType || "individual_coaching";

    const feeRecord = await activitiesRepo.getFeeForActivity(
        parseInt(activity_id),
        coachingType,
        parseInt(term_months)
    );

    if (!feeRecord) {
        const err = new Error("No fee found for the selected activity and duration. Check activity_id and term_months.");
        err.status = 400;
        throw err;
    }

    const amount = parseFloat(feeRecord.total_fee);
    const tempUuid = crypto.randomUUID();

    const order = await razorpay.createOrder(amount, tempUuid, {
        temp_uuid: tempUuid,
        service_type: serviceType,
    });

    // Embed the Razorpay order_id in form_data so we can cross-reference later if needed
    formData.razorpay_order_id = order.id;

    await repo.insertPendingRegistration(tempUuid, formData, serviceType);

    return {
        tempUuid,
        orderId: order.id,
        amount,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
    };
};

/**
 * PHASE 2 — Finalize registration after Razorpay confirms payment via webhook.
 */
exports.finalizeRegistration = async (tempUuid) => {
    const pending = await repo.getPendingByUuid(tempUuid);
    if (!pending) throw new Error("Registration record not found or already processed");

    const data = (typeof pending.form_data === "string"
        ? JSON.parse(pending.form_data)
        : pending.form_data) || {};

    const result = await prisma.$transaction(async (tx) => {
        const userId    = await repo.insertUser(tx, data.user_info);
        const studentId = await repo.insertStudent(tx, userId, pending.service_type);
        await repo.insertindividualcoaching(tx, studentId, data.individualcoaching);
        if (data.consentDetails?.parentName) {
            await repo.insertParentConsent(tx, studentId, data.consentDetails);
        }
        return { userId };
    });

    await repo.updatePendingStatus(pending.id, "approved");
    return { userId: result.userId, success: true };
};

/**
 * PHASE 3 — Flutter polls this to get its JWT once the webhook has fired.
 *
 * getPendingByUuid filters by status=pending so it returns null after approval.
 * We use getPendingByUuidAny here to find approved records too, then look up the
 * user by mobile to get the userId for JWT generation.
 */
exports.getRegistrationStatus = async (tempUuid) => {
    const pending = await repo.getPendingByUuidAny(tempUuid);
    if (!pending) return { status: "not_found" };
    if (pending.status !== "approved") return { status: pending.status };

    const formData = typeof pending.form_data === "string"
        ? JSON.parse(pending.form_data)
        : pending.form_data;

    const mobile = formData.user_info?.contactNumber || formData.contactNumber || formData.mobile;
    const user = await prisma.users.findFirst({ where: { mobile }, select: { id: true } });

    return { status: "approved", userId: user?.id ?? null };
};
