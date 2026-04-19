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
    const { activity_ids, term_months, coaching_type } = formData.payment || {};

    if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0 || !term_months) {
        const err = new Error("activity_ids (array) and term_months are required to calculate the fee");
        err.status = 400;
        throw err;
    }

    let coachingType = coaching_type || serviceType || "individual_coaching";

    // Duplicate check 1 — same mobile already has an approved (paid) registration for one of these activities
    // Only 'approved' is checked here — 'pending' rows are abandoned attempts (user went back without paying)
    // and must not block a fresh attempt.
    const mobile = formData.user_info?.contactNumber || null;
    if (mobile) {
        for (const actId of activity_ids) {
            const paidDuplicate = await prisma.$queryRaw`
                SELECT id FROM pending_registrations
                WHERE status = 'approved'
                  AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.user_info.contactNumber')) = ${mobile}
                  AND JSON_CONTAINS(
                        JSON_EXTRACT(form_data, '$.payment.activity_ids'),
                        CAST(${parseInt(actId)} AS JSON)
                      )
                LIMIT 1
            `;
            if (paidDuplicate.length > 0) {
                const err = new Error("You are already enrolled in this activity.");
                err.status = 409;
                throw err;
            }
        }

        // Duplicate check 2 — same mobile has an active individual_participant record (is_active = true).
        // This catches re-registrations after the student record was fully created.
        const activeEnrollment = await prisma.$queryRaw`
            SELECT ip.id FROM individual_participants ip
            INNER JOIN students s ON s.id = ip.student_id
            INNER JOIN users u ON u.id = s.user_id
            WHERE u.mobile = ${mobile}
              AND ip.is_active = 1
            LIMIT 1
        `;
        if (activeEnrollment.length > 0) {
            const err = new Error("You are already enrolled in an active coaching plan for this activity.");
            err.status = 409;
            throw err;
        }
    }

    // Resolve society_category for fee lookup — society students pay group_coaching rates,
    // but their student_type stays "individual_coaching" (they registered via the IC form).
    let societyCategory = null;
    let feeCoachingType = coachingType;
    if (coachingType === "individual_coaching" || coachingType === "group_coaching") {
        const societyId = formData.individualcoaching?.society_id;
        if (societyId) {
            const society = await prisma.societies.findUnique({
                where: { id: parseInt(societyId) },
                select: { society_category: true },
            });
            societyCategory = society?.society_category ?? null;
            if (societyCategory) feeCoachingType = "group_coaching";
        }
    }

    // Sum fees for all selected activities
    const ids = activity_ids.map((id) => parseInt(id));
    const feeRecords = await activitiesRepo.getFeesForActivities(
        ids,
        feeCoachingType,
        parseInt(term_months),
        societyCategory ?? undefined
    );

    if (feeRecords.length === 0) {
        const err = new Error("No fee found for the selected activities and duration. Check activity_ids and term_months.");
        err.status = 400;
        throw err;
    }

    console.log(`[IC] fee records found: ${feeRecords.length}/${ids.length} | studentType: ${coachingType} | feeCoachingType: ${feeCoachingType}`);

    const amount = feeRecords.reduce((sum, r) => sum + parseFloat(r.total_fee), 0);
    const tempUuid = crypto.randomUUID();

    const order = await razorpay.createOrder(amount, tempUuid, {
        temp_uuid: tempUuid,
        service_type: coachingType,
    });

    // Embed the Razorpay order_id and computed amount in form_data for later use
    formData.razorpay_order_id = order.id;
    formData.calculated_amount = amount;

    await repo.insertPendingRegistration(tempUuid, formData, coachingType);

    const fcmToken = formData.fcmToken || formData.fcm_token;
    if (fcmToken) {
        const { sendNotificationToToken } = require("../../../utils/fcm");
        sendNotificationToToken(fcmToken, "Data Captured", "Your form data has been captured, please complete your payment.");
    }

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

    const termMonths = data.payment?.term_months ? parseInt(data.payment.term_months) : 1;

    const result = await prisma.$transaction(async (tx) => {
        const userId    = await repo.insertUser(tx, data.user_info);
        const studentId = await repo.insertStudent(tx, userId, pending.service_type);
        await repo.insertindividualcoaching(tx, studentId, data.individualcoaching, termMonths);
        if (data.consentDetails?.parentName) {
            await repo.insertParentConsent(tx, studentId, data.consentDetails);
        }
        return { userId, studentId };
    });

    await repo.updatePendingStatus(pending.id, "approved");

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

    // Auto-assign student to a group coaching batch if applicable
    if (pending.service_type === "group_coaching") {
        try {
            await autoAssignToBatch(result.studentId, data);
        } catch (err) {
            // Non-fatal: student registered successfully, batch assignment failed
            console.error("[IC] Auto-batch assignment failed:", err.message);
        }
    }

    return { userId: result.userId, success: true };
};

/**
 * Auto-assign a newly registered group_coaching student to an available batch
 * for their society + activity. Picks the first active batch with < capacity students.
 * If all batches are full (or none exist) the student stays unassigned.
 */
async function autoAssignToBatch(studentId, formData) {
    const societyId  = formData.individualcoaching?.society_id ? parseInt(formData.individualcoaching.society_id) : null;
    const activityIds = formData.payment?.activity_ids?.map(Number) || [];

    if (!societyId || activityIds.length === 0) return;

    for (const activityId of activityIds) {
        // Find active group_coaching batches for this society+activity ordered by created_at
        const batches = await prisma.batches.findMany({
            where: {
                batch_type:  "group_coaching",
                society_id:  societyId,
                activity_id: activityId,
                is_active:   true,
            },
            include: {
                _count: { select: { batch_students: true } },
            },
            orderBy: { created_at: "asc" },
        });

        const availableBatch = batches.find(b => b._count.batch_students < b.capacity);
        if (!availableBatch) continue; // no room — student stays unassigned for this activity

        // Add to batch_students
        await prisma.batch_students.create({
            data: { batch_id: availableBatch.id, student_id: studentId },
        });

        // Record the assigned batch on the individual_participant record
        await prisma.individual_participants.updateMany({
            where: { student_id: studentId, batch_id: null },
            data:  { batch_id: availableBatch.id },
        });

        // Add student as participant to all future scheduled sessions of this batch
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureSessions = await prisma.sessions.findMany({
            where: {
                batch_id:       availableBatch.id,
                scheduled_date: { gte: today },
                status:         { in: ["scheduled", "ongoing"] },
            },
            select: { id: true },
        });

        if (futureSessions.length > 0) {
            await prisma.session_participants.createMany({
                data:           futureSessions.map(s => ({ session_id: s.id, student_id: studentId })),
                skipDuplicates: true,
            });
        }

        console.log(`[IC] Student ${studentId} auto-assigned to batch ${availableBatch.id} (society ${societyId}, activity ${activityId})`);
    }
}

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
