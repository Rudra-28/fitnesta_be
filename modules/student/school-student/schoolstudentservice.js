const prisma = require("../../../config/prisma");
const crypto = require("crypto");
const repo = require("./schoolstudentrepo");
const activitiesRepo = require("../../activities/activitiesrepository");
const razorpay = require("../../../utils/razorpay");

/**
 * PHASE 1 — Park form data and create a Razorpay order.
 *
 * School students are always enrolled for a fixed 9-month term.
 * The controller must include formData.payment = { activity_id }
 * where activity_id maps to the activity in the fee_structures table.
 *
 * Returns: { tempUuid, orderId, amount, currency, keyId }
 */
exports.initiateRegistration = async (formData, serviceType) => {
    const { activity_id } = formData.payment || {};

    if (!activity_id) {
        const err = new Error("activity_id is required to calculate the fee");
        err.status = 400;
        throw err;
    }

    // School student term is always 9 months — no need for frontend to send term_months
    const feeRecord = await activitiesRepo.getFeeForActivity(
        parseInt(activity_id),
        "school_student",
        9
    );

    if (!feeRecord) {
        const err = new Error("No fee found for the selected activity. Check activity_id.");
        err.status = 400;
        throw err;
    }

    const amount = parseFloat(feeRecord.total_fee);
    const tempUuid = crypto.randomUUID();

    const order = await razorpay.createOrder(amount, tempUuid, {
        temp_uuid: tempUuid,
        service_type: serviceType,
    });

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

    const data = typeof pending.form_data === "string"
        ? JSON.parse(pending.form_data)
        : pending.form_data;

    const result = await prisma.$transaction(async (tx) => {
        const userId    = await repo.insertUser(tx, data);
        const studentId = await repo.insertStudent(tx, userId, pending.service_type);
        await repo.insertSchoolStudent(tx, studentId, data);
        return { userId };
    });

    await repo.updatePendingStatus(pending.id, "approved");
    return { userId: result.userId, success: true };
};

/**
 * PHASE 3 — Flutter polls this to get its JWT once the webhook has fired.
 */
exports.getRegistrationStatus = async (tempUuid) => {
    const pending = await repo.getPendingByUuidAny(tempUuid);
    if (!pending) return { status: "not_found" };
    if (pending.status !== "approved") return { status: pending.status };

    const formData = typeof pending.form_data === "string"
        ? JSON.parse(pending.form_data)
        : pending.form_data;

    // School student form stores mobile at the top level (flat structure)
    const mobile = formData.mobile || formData.contactNumber || formData.contact_number;
    const user = await prisma.users.findFirst({ where: { mobile }, select: { id: true } });

    return { status: "approved", userId: user?.id ?? null };
};
