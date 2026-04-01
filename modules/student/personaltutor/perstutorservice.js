const prisma = require("../../../config/prisma");
const crypto = require("crypto");
const repo = require("./perstutorrepo");
const activitiesRepo = require("../../activities/activitiesrepository");
const razorpay = require("../../../utils/razorpay");
const paymentsRepo = require("../../payments/paymentsrepo");
const commissionService = require("../../commissions/commissionservice");

/**
 * PHASE 1 — Park form data and create a Razorpay order.
 *
 * Personal tutor supports multiple subjects in one registration.
 * The controller must include formData.payment = { activity_ids, term_months, standard }
 * where activity_ids is an array of ints (one per subject selected).
 *
 * Total fee = sum of each subject's fee at the given standard and term.
 *
 * Returns: { tempUuid, orderId, amount, currency, keyId }
 */
exports.initiateRegistration = async (formData, serviceType) => {
    const { activity_ids, term_months, standard } = formData.payment || {};

    if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0) {
        const err = new Error("activity_ids (array) is required to calculate the fee");
        err.status = 400;
        throw err;
    }
    if (!term_months) {
        const err = new Error("term_months is required to calculate the fee");
        err.status = 400;
        throw err;
    }
    if (!standard) {
        const err = new Error("standard is required to calculate the fee for personal tutor");
        err.status = 400;
        throw err;
    }

    const ids = activity_ids.map((id) => parseInt(id));

    const feeRecords = await activitiesRepo.getFeesForActivities(
        ids,
        "personal_tutor",
        parseInt(term_months),
        standard
    );

    if (feeRecords.length === 0) {
        const err = new Error("No fee structure found for the selected subjects, standard, and duration");
        err.status = 400;
        throw err;
    }

    // Warn if some activity_ids had no matching fee row (misconfigured data or wrong IDs)
    if (feeRecords.length !== ids.length) {
        const foundIds = feeRecords.map((r) => r.activity_id);
        const missing = ids.filter((id) => !foundIds.includes(id));
        const err = new Error(`No fee found for activity_id(s): ${missing.join(", ")} at standard ${standard}`);
        err.status = 400;
        throw err;
    }

    const amount = feeRecords.reduce((sum, r) => sum + parseFloat(r.total_fee), 0);
    const tempUuid = crypto.randomUUID();

    const order = await razorpay.createOrder(amount, tempUuid, {
        temp_uuid: tempUuid,
        service_type: serviceType,
    });

    formData.razorpay_order_id = order.id;
    formData.calculated_amount = amount;

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
        const userId    = await repo.insertUser(tx, data.user_info);
        const studentId = await repo.insertStudent(tx, userId, "personal_tutor");
        await repo.insertpersonalTutor(tx, studentId, data.tutorDetails);
        await repo.insertParentConsent(tx, studentId, data.consentDetails);
        return { userId };
    });

    await repo.updatePendingStatus(pending.id, "approved");

    await paymentsRepo.recordPayment({
        tempUuid,
        razorpayOrderId:   data.razorpay_order_id,
        razorpayPaymentId,
        serviceType:       pending.service_type,
        amount,
        studentUserId:     result.userId,
    });

    // Calculate ME admission commission (fire-and-forget — never throws)
    await commissionService.calculateMEAdmissionCommission(
        pending.service_type,
        data,
        result.userId,
        amount
    );

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

    const mobile = formData.user_info?.contactNumber || formData.contactNumber || formData.mobile;
    const user = await prisma.users.findFirst({
        where: { mobile },
        select: { id: true, full_name: true, mobile: true },
    });

    return { status: "approved", userId: user?.id ?? null, user };
};
