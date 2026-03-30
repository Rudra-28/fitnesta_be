const prisma = require("../../../config/prisma");
const crypto = require("crypto");
const repo = require("./schoolstudentrepo");
const activitiesRepo = require("../../activities/activitiesrepository");
const vendorRepo = require("../../professionals/vendor/vendordashboard/vendordashboardrepo");
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
    const { activity_ids = [], product_ids = [] } = formData.payment || {};

    if (!activity_ids.length) {
        const err = new Error("At least one activity_id is required to calculate the fee");
        err.status = 400;
        throw err;
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

    let amount = feeRecords.reduce((sum, r) => sum + parseFloat(r.total_fee), 0);
    formData.activity_ids = activity_ids; // persist for finalize phase

    // Add kit costs from vendor products if any were selected
    if (product_ids.length > 0) {
        const products = await vendorRepo.getProductsByIds(product_ids);
        if (products.length > 0) {
            const kitTotal = products.reduce((sum, p) => sum + parseFloat(p.selling_price), 0);
            amount += kitTotal;
            formData.product_ids = products.map(p => p.id); // only store found IDs
        }
    }
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
    const user = await prisma.users.findFirst({ where: { mobile }, select: { id: true } });

    return { status: "approved", userId: user?.id ?? null };
};
