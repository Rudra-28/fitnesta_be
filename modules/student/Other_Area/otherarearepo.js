const prisma = require("../../../config/prisma");
const crypto = require("crypto");

// ── STEP 1: Stage submission ───────────────────────────────────────────────
exports.insertPending = async (formData, serviceType) => {
    const tempUuid = crypto.randomUUID();
    await prisma.pending_registrations.create({
        data: {
            temp_uuid: tempUuid,
            form_data: formData,
            service_type: serviceType,
            status: "pending",
        },
    });
    return tempUuid;
};

// Duplicate check — approved table + pending JSON blob
exports.findByMobile = async (mobile) => {
    const approved = await prisma.other_areas.findFirst({
        where: { mobile },
        select: { id: true },
    });
    if (approved) return { exists: true, where: "approved" };

    const pending = await prisma.$queryRaw`
        SELECT id, service_type FROM pending_registrations
        WHERE status = 'pending'
          AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.mobile')) = ${mobile}
        LIMIT 1
    `;
    if (pending.length)
        return { exists: true, where: "pending", serviceType: pending[0].service_type };

    return { exists: false };
};

exports.cancelPendingRequest = async (mobile) => {
    await prisma.$executeRaw`
        UPDATE pending_registrations
        SET status = 'rejected',
            review_note = 'Superseded by enrollment form submission'
        WHERE service_type = 'other_area_request'
          AND status = 'pending'
          AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.mobile')) = ${mobile}
    `;
};

// ── Called inside a Prisma transaction (tx) ────────────────────────────────
exports.findProfessionalByReferralCode = async (tx, referralCode) => {
    const client = tx ?? prisma;
    return await client.professionals.findFirst({
        where: { referral_code: referralCode },
        select: { id: true },
    });
};

exports.insertUser = async (tx, data) => {
    const mobile = data.mobile || null;
    if (mobile) {
        const existing = await tx.users.findUnique({ where: { mobile }, select: { id: true } });
        if (existing) return existing.id;
    }
    const user = await tx.users.create({
        data: { uuid: crypto.randomUUID(), role: "student", mobile },
    });
    return user.id;
};

exports.insertStudent = async (tx, userId) => {
    const student = await tx.students.create({
        data: { user_id: userId, student_type: "group_coaching" },
    });
    return student.id;
};

// me_professional_id not in Prisma model — raw insert; uses tx so it stays in the transaction
exports.insertOtherArea = async (tx, data, studentId, meProfessionalId = null) => {
    await tx.$executeRaw`
        INSERT INTO other_areas
            (student_id, sponsor_name, coordinator_name, address, mobile,
             marketing_incharge, me_professional_id, activity_agreement_pdf)
        VALUES (${studentId}, ${data.sponsorName}, ${data.coordinatorName},
                ${data.address}, ${data.mobile}, ${data.marketingIncharge},
                ${meProfessionalId}, ${data.activityAgreementPdf ?? null})
    `;
};

// ── Non-transaction reads/writes ───────────────────────────────────────────
exports.findProfessionalByUserId = async (userId) => {
    return await prisma.professionals.findFirst({
        where: { user_id: userId },
        select: { id: true, referral_code: true },
    });
};

exports.getPendingById = async (id) => {
    return await prisma.pending_registrations.findFirst({ where: { id } });
};

exports.getPendingRequests = async () => {
    return await prisma.pending_registrations.findMany({
        where: { status: "pending", service_type: "other_area_request" },
        select: { id: true, temp_uuid: true, service_type: true, form_data: true, created_at: true },
        orderBy: { created_at: "desc" },
    });
};

exports.getPendingEnrollments = async () => {
    return await prisma.pending_registrations.findMany({
        where: { status: "pending", service_type: "other_area_enrollment" },
        select: { id: true, temp_uuid: true, service_type: true, form_data: true, created_at: true },
        orderBy: { created_at: "desc" },
    });
};

exports.getPendingEnrollmentsForMe = async (meReferralCode) => {
    return await prisma.$queryRaw`
        SELECT id, temp_uuid, service_type, form_data, created_at
        FROM pending_registrations
        WHERE status = 'pending'
          AND service_type = 'other_area_enrollment'
          AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.referralCode')) = ${meReferralCode}
        ORDER BY created_at DESC
    `;
};

exports.markPendingReviewed = async (id, status, reviewedBy, note) => {
    await prisma.pending_registrations.update({
        where: { id },
        data: { status, reviewed_by: reviewedBy, review_note: note ?? null, reviewed_at: new Date() },
    });
};
