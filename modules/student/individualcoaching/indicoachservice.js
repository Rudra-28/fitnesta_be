const prisma = require("../../../config/prisma");
const crypto = require("crypto");
const repo = require("./indicoachrepo");
const activitiesRepo = require("../../activities/activitiesrepository");
const razorpay = require("../../../utils/razorpay");
const paymentsRepo = require("../../payments/paymentsrepo");
const commissionService = require("../../commissions/commissionservice");

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

    let coachingType = coaching_type || serviceType || "individual_coaching";

    // Duplicate check — same mobile + same activity already pending or approved
    const mobile = formData.user_info?.contactNumber || null;
    if (mobile) {
        const activityIdInt = parseInt(activity_id);
        const duplicate = await prisma.$queryRaw`
            SELECT id FROM pending_registrations
            WHERE status IN ('pending', 'approved')
              AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.user_info.contactNumber')) = ${mobile}
              AND JSON_EXTRACT(form_data, '$.payment.activity_id') = ${activityIdInt}
            LIMIT 1
        `;
        if (duplicate.length > 0) {
            const err = new Error("You have already registered for this activity.");
            err.status = 409;
            throw err;
        }
    }

    let feeRecord = await activitiesRepo.getFeeForActivity(
        parseInt(activity_id),
        coachingType,
        parseInt(term_months)
    );

    // If not found and coachingType is individual_coaching, retry as group_coaching.
    // This handles the group-coaching individual participant flow which shares this endpoint.
    // Resolve society_category from the society record so the correct fee tier is used.
    if (!feeRecord && coachingType === "individual_coaching") {
        const societyId = formData.individualcoaching?.society_id;
        let societyCategory = null;
        if (societyId) {
            const society = await prisma.societies.findUnique({
                where: { id: parseInt(societyId) },
                select: { society_category: true },
            });
            societyCategory = society?.society_category ?? null;
        }
        feeRecord = await activitiesRepo.getFeeForActivity(
            parseInt(activity_id),
            "group_coaching",
            parseInt(term_months),
            societyCategory
        );
        if (feeRecord) coachingType = "group_coaching";
    }

    if (!feeRecord) {
        const err = new Error("No fee found for the selected activity and duration. Check activity_id and term_months.");
        err.status = 400;
        throw err;
    }

    const amount = parseFloat(feeRecord.total_fee);
    const tempUuid = crypto.randomUUID();

    const order = await razorpay.createOrder(amount, tempUuid, {
        temp_uuid: tempUuid,
        service_type: coachingType,
    });

    // Embed the Razorpay order_id and computed amount in form_data for later use
    formData.razorpay_order_id = order.id;
    formData.calculated_amount = amount;

    await repo.insertPendingRegistration(tempUuid, formData, coachingType);

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

    const termMonths = data.payment?.term_months ? parseInt(data.payment.term_months) : 1;

    await paymentsRepo.recordPayment({
        tempUuid,
        razorpayOrderId:   data.razorpay_order_id,
        razorpayPaymentId,
        serviceType:       pending.service_type,
        amount,
        termMonths,
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
    const user = await prisma.users.findFirst({
        where: { mobile },
        select: { id: true, full_name: true, mobile: true },
    });

    return { status: "approved", userId: user?.id ?? null, user };
};
