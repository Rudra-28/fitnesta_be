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

// Check approved societies table, then pending_registrations JSON blob
exports.findBySocietyUniqueId = async (societyUniqueId) => {
    const approved = await prisma.societies.findFirst({
        where: { society_unique_id: societyUniqueId },
        select: { id: true },
    });
    if (approved) return { exists: true, where: "approved", serviceType: null };

    // JSON_EXTRACT needed — raw query
    const pending = await prisma.$queryRaw`
        SELECT id, service_type FROM pending_registrations
        WHERE status = 'pending'
          AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.societyUniqueId')) = ${societyUniqueId}
        LIMIT 1
    `;
    if (pending.length)
        return { exists: true, where: "pending", serviceType: pending[0].service_type };

    return { exists: false };
};

// Auto-cancel a pending society_request when enrollment supersedes it
exports.cancelPendingRequest = async (societyUniqueId) => {
    await prisma.$executeRaw`
        UPDATE pending_registrations
        SET status = 'rejected',
            review_note = 'Superseded by enrollment form submission'
        WHERE service_type = 'society_request'
          AND status = 'pending'
          AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.societyUniqueId')) = ${societyUniqueId}
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
    const user = await tx.users.create({
        data: {
            role: "student",
            full_name: data.authorityPersonName ?? null,
            mobile: data.authorityContact ?? null,
        },
    });
    return user.id;
};

exports.insertSociety = async (tx, data, userId, meProfessionalId = null) => {
    const society = await tx.societies.create({
        data: {
            society_unique_id: data.societyUniqueId,
            registered_by_user_id: userId,
            me_professional_id: meProfessionalId,
            society_name: data.societyName ?? null,
            society_category: data.societyCategory ?? null,
            address: data.address ?? null,
            pin_code: data.pinCode ?? null,
            total_participants: data.totalParticipants ? Number(data.totalParticipants) : null,
            no_of_flats: data.noOfFlats ? Number(data.noOfFlats) : null,
            proposed_wing: data.proposedWing ?? null,
            authority_role: data.authorityRole ?? null,
            authority_person_name: data.authorityPersonName ?? null,
            contact_number: data.contactNumber ?? null,
            playground_available: data.playgroundAvailable ? true : false,
            agreement_signed_by_authority: data.hasSignedAgreement ? true : false,
            activity_agreement_pdf: data.activityAgreementPdf ?? null,
        },
    });
    return society.id;
};

// ── Non-transaction reads ──────────────────────────────────────────────────

exports.findProfessionalByUserId = async (userId) => {
    return await prisma.professionals.findFirst({
        where: { user_id: userId },
        select: { id: true, referral_code: true },
    });
};

exports.getPendingById = async (id) => {
    return await prisma.pending_registrations.findFirst({
        where: { id },
    });
};

exports.getPendingRequests = async () => {
    return await prisma.pending_registrations.findMany({
        where: { status: "pending", service_type: "society_request" },
        select: { id: true, temp_uuid: true, service_type: true, form_data: true, created_at: true },
        orderBy: { created_at: "desc" },
    });
};

exports.getPendingEnrollments = async () => {
    return await prisma.pending_registrations.findMany({
        where: { status: "pending", service_type: "society_enrollment" },
        select: { id: true, temp_uuid: true, service_type: true, form_data: true, created_at: true },
        orderBy: { created_at: "desc" },
    });
};

// JSON_EXTRACT needed — raw query
exports.getPendingEnrollmentsForMe = async (meReferralCode) => {
    return await prisma.$queryRaw`
        SELECT id, temp_uuid, service_type, form_data, created_at
        FROM pending_registrations
        WHERE status = 'pending'
          AND service_type = 'society_enrollment'
          AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.referralCode')) = ${meReferralCode}
        ORDER BY created_at DESC
    `;
};

exports.markPendingReviewed = async (id, status, reviewedBy, note) => {
    await prisma.pending_registrations.update({
        where: { id },
        data: {
            status,
            reviewed_by: reviewedBy,
            review_note: note ?? null,
            reviewed_at: new Date(),
        },
    });
};

exports.getAllSocieties = async () => {
    return await prisma.societies.findMany({
        select: {
            id: true,
            society_name: true,
            address: true,
            pin_code: true,
            society_category: true,
            agreement_signed_by_authority: true,
            approval_status: true,
        },
        orderBy: { society_name: "asc" },
    });
};
