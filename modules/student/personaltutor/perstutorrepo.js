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
            address: data?.address || null,
            mobile,
        },
    });
    return user.id;
};

exports.insertStudent = async (tx, userId, type) => {
    const student = await tx.students.create({
        data: { user_id: userId, student_type: type },
    });
    return student.id;
};

exports.insertpersonalTutor = async (tx, studentId, data) => {
    await tx.personal_tutors.create({
        data: {
            student_id: studentId,
            dob: data?.dob ? new Date(data.dob) : null,
            standard: data?.standard || null,
            batch: data?.batch || null,
            teacher_for: data?.teacherFor || null,
        },
    });
};

exports.insertParentConsent = async (tx, studentId, data) => {
    if (!data) return null;
    await tx.parent_consents.create({
        data: {
            student_id: studentId,
            society_name: data.society_name || null,
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
            service_type: serviceType || "personal_tutor",
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

// ── Utility ────────────────────────────────────────────────────────────────
exports.getpersonaltutordetails = async (userId) => {
    return await prisma.users.findFirst({
        where: { id: userId },
        select: {
            full_name: true,
            address: true,
            mobile: true,
            students: {
                select: {
                    id: true,
                    student_type: true,
                    personal_tutors: {
                        select: {
                            dob: true,
                            standard: true,
                            batch: true,
                            teacher_for: true,
                        },
                    },
                },
            },
        },
    });
};
