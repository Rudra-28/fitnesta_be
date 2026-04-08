const prisma = require("../../config/prisma");

/**
 * Insert a captured payment record.
 * Called inside finalizeRegistration (outside the Prisma transaction)
 * so the payment row is always written even if commission logic is added later.
 *
 * @param {object} data
 * @param {string} data.tempUuid
 * @param {string} data.razorpayOrderId
 * @param {string} data.razorpayPaymentId
 * @param {string} data.serviceType        - 'individual_coaching' | 'personal_tutor' | 'school_student'
 * @param {number} data.amount             - in INR
 * @param {number} data.termMonths         - duration purchased: 1 | 3 | 6 | 9
 * @param {number} data.studentUserId      - users.id of the newly created student
 */
exports.recordPayment = async (data) => {
    const termMonths = data.termMonths || 1;
    await prisma.$executeRaw`
        INSERT INTO payments
            (temp_uuid, razorpay_order_id, razorpay_payment_id, service_type, amount, term_months, student_user_id)
        VALUES
            (${data.tempUuid}, ${data.razorpayOrderId}, ${data.razorpayPaymentId},
             ${data.serviceType}, ${data.amount}, ${termMonths}, ${data.studentUserId})
    `;
};
/**
 * Fetch a payment record by temp_uuid.
 * Useful for admin lookups and commission triggers later.
 */
exports.getPaymentByTempUuid = async (tempUuid) => {
    const rows = await prisma.$queryRaw`
        SELECT * FROM payments WHERE temp_uuid = ${tempUuid} LIMIT 1
    `;
    return rows[0] ?? null;
};

/**
 * Fetch a pending registration by temp_uuid (any status).
 * Used by the verify endpoint to look up service_type before finalizing.
 */
exports.getPendingRegistration = async (tempUuid) => {
    return await prisma.pending_registrations.findFirst({
        where: { temp_uuid: tempUuid },
    });
};

/**
 * Fetch a single payment + its pending_registration form_data.
 * studentUserId guard ensures students can only read their own receipts.
 */
exports.getReceiptData = async (tempUuid, studentUserId) => {
    const rows = await prisma.$queryRaw`
        SELECT
            p.temp_uuid,
            p.razorpay_payment_id,
            p.service_type,
            p.amount,
            p.term_months,
            p.captured_at AS paid_at,
            pr.form_data
        FROM payments p
        JOIN pending_registrations pr ON pr.temp_uuid = p.temp_uuid
        WHERE p.temp_uuid = ${tempUuid}
          AND p.student_user_id = ${studentUserId}
        LIMIT 1
    `;
    return rows[0] ?? null;
};

/**
 * Fetch all payments for a student, newest first.
 */
exports.getStudentReceipts = async (studentUserId) => {
    return await prisma.$queryRaw`
        SELECT
            p.temp_uuid,
            p.razorpay_payment_id,
            p.service_type,
            p.amount,
            p.term_months,
            p.captured_at AS paid_at,
            pr.form_data
        FROM payments p
        JOIN pending_registrations pr ON pr.temp_uuid = p.temp_uuid
        WHERE p.student_user_id = ${studentUserId}
        ORDER BY p.captured_at DESC
    `;
};
