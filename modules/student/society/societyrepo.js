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
    if (approved) return { exists: true, where: "approved" };

    const pending = await prisma.$queryRaw`
        SELECT id FROM pending_registrations
        WHERE status = 'pending'
          AND service_type = 'society_request'
          AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.societyUniqueId')) = ${societyUniqueId}
        LIMIT 1
    `;
    if (pending.length) return { exists: true, where: "pending" };

    return { exists: false };
};

exports.getPendingById = async (id) => {
    return await prisma.pending_registrations.findFirst({
        where: { id },
    });
};

exports.getPendingRequests = async () => {
    return await prisma.pending_registrations.findMany({
        where: { status: "pending", service_type: "society_request" },
        select: {
            id: true,
            temp_uuid: true,
            service_type: true,
            form_data: true,
            created_at: true,
            assigned_me_id: true,
            assigned_me_at: true,
        },
        orderBy: { created_at: "desc" },
    });
};

exports.findProfessionalById = async (id) => {
    return await prisma.professionals.findFirst({
        where: { id },
        select: { id: true },
    });
};

exports.assignMe = async (pendingId, meProfessionalId) => {
    await prisma.pending_registrations.update({
        where: { id: pendingId },
        data: {
            assigned_me_id: meProfessionalId,
            assigned_me_at: new Date(),
        },
    });
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
            custom_category_name: true,
            agreement_signed_by_authority: true,
            approval_status: true,
        },
        orderBy: { society_name: "asc" },
    });
};
