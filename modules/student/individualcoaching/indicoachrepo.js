const prisma = require("../../../config/prisma");
const crypto = require("crypto");

// ── Called inside a Prisma transaction (tx) ────────────────────────────────
exports.insertUser = async (tx, data) => {
    const mobile = data?.contactNumber || null;
    if (mobile) {
        const existing = await tx.users.findUnique({ where: { mobile }, select: { id: true } });
        if (existing) return existing.id;
    }
    const user = await tx.users.create({
        data: {
            uuid: crypto.randomUUID(),
            role: "student",
            full_name: data?.fullName || null,
            mobile,
            approval_status: "approved",
        },
    });
    return user.id;
};

exports.insertStudent = async (tx, userId, type) => {
    const student = await tx.students.create({
        data: { user_id: userId, student_type: type || "individual_coaching" },
    });
    return student.id;
};

exports.insertindividualcoaching = async (tx, studentId, data, termMonths = 1) => {
    await tx.individual_participants.create({
        data: {
            student_id:  studentId,
            flat_no:     data?.flat_no || null,
            dob:         data?.dob ? new Date(data.dob) : null,
            age: data?.age ? parseInt(data.age) : null,
            society_id:  data?.society_id ? parseInt(data.society_id) : null,
            society_name: data?.society_name || null,
            activity:    data?.activities ? String(data.activities).slice(0, 100) : null,
            kits:        data?.kit_type || null,
            preferred_batch: data?.preferred_batch || null,
            preferred_time: data?.preferred_time || data?.preferredTime || null,
            term_months: termMonths,
        },
    });
};

exports.insertParentConsent = async (tx, studentId, data) => {
    await tx.parent_consents.create({
        data: {
            student_id: studentId,
            society_name: data.society_name  || null,
            parent_name: data.parentName || null,
            emergency_contact_no: data.emergencyContactNo || null,
            activity_enrolled: data.activity_enrolled || null,
            parent_signature_doc: data.signatureUrl || null,
            consent_date: data.consent_date ? new Date(data.consent_date) : new Date(),
        },
    });
};

// ── Pending state ──────────────────────────────────────────────────────────
exports.insertPendingRegistration = async (tempUuid, formData, serviceType) => {
    await prisma.pending_registrations.create({
        data: {
            temp_uuid: tempUuid,
            form_data: formData,
            service_type: serviceType || "individual_coaching",
            status: "pending",
        },
    });
};

exports.getPendingByUuid = async (tempUuid) => {
    return await prisma.pending_registrations.findFirst({
        where: { temp_uuid: tempUuid, status: "pending" },
    });
};

// Used by getRegistrationStatus — needs to find the record even after it's approved
exports.getPendingByUuidAny = async (tempUuid) => {
    return await prisma.pending_registrations.findFirst({
        where: { temp_uuid: tempUuid },
    });
};

exports.updatePendingStatus = async (id, status) => {
    await prisma.pending_registrations.update({
        where: { id },
        data: { status },
    });
};
