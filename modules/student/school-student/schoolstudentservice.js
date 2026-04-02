const prisma = require("../../../config/prisma");
const crypto = require("crypto");
const repo = require("./schoolstudentrepo");
const activitiesRepo = require("../../activities/activitiesrepository");
const razorpay = require("../../../utils/razorpay");
const paymentsRepo = require("../../payments/paymentsrepo");

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
    const { activity_ids = [] } = formData.payment || {};

    if (!activity_ids.length) {
        const err = new Error("At least one activity_id is required to calculate the fee");
        err.status = 400;
        throw err;
    }

    // Duplicate check — same mobile + any of the selected activities already pending or approved
    const mobile = formData.mobile || formData.contactNumber || null;
    if (mobile) {
        for (const actId of activity_ids) {
            const duplicate = await prisma.$queryRaw`
                SELECT id FROM pending_registrations
                WHERE status IN ('pending', 'approved')
                  AND (
                        JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.mobile')) = ${mobile}
                        OR JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.contactNumber')) = ${mobile}
                      )
                  AND JSON_CONTAINS(
                        JSON_EXTRACT(form_data, '$.payment.activity_ids'),
                        CAST(${actId} AS JSON)
                      )
                LIMIT 1
            `;
            if (duplicate.length > 0) {
                const err = new Error("You have already registered for one or more of the selected activities.");
                err.status = 409;
                throw err;
            }
        }
    }

    // School student term is always 9 months — look up fee for each activity and sum
    const feeRecords = await Promise.all(
        activity_ids.map(id => activitiesRepo.getFeeForActivity(id, "school_student", 9))
    );

    const missing = activity_ids.filter((_, i) => !feeRecords[i]);
    if (missing.length > 0) {
        const err = new Error(`No fee found for activity_id(s): ${missing.join(", ")}`);
        err.status = 400;
        throw err;
    }

    const amount = feeRecords.reduce((sum, r) => sum + parseFloat(r.total_fee), 0);
    formData.activity_ids = activity_ids; // persist for finalize phase
    formData.calculated_amount = amount;

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
 * @param {string} tempUuid
 * @param {string} razorpayPaymentId - entity.id from webhook payload
 * @param {number} amount            - entity.amount / 100 (INR)
 */
exports.finalizeRegistration = async (tempUuid, razorpayPaymentId, amount) => {
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

    await paymentsRepo.recordPayment({
        tempUuid,
        razorpayOrderId:   data.razorpay_order_id,
        razorpayPaymentId,
        serviceType:       pending.service_type,
        amount,
        termMonths:        9, // school_student term is always 9 months
        studentUserId:     result.userId,
    });

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
    const user = await prisma.users.findFirst({
        where: { mobile },
        select: { id: true, full_name: true, mobile: true },
    });

    return { status: "approved", userId: user?.id ?? null, user };
};
