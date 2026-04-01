const prisma = require("../../../config/prisma");
const crypto = require("crypto");

// ── Called inside a Prisma transaction (tx) ────────────────────────────────
exports.insertUser = async (tx, data) => {
    const mobile = data.mobile || null;
    if (mobile) {
        const existing = await tx.users.findUnique({ where: { mobile }, select: { id: true } });
        if (existing) return existing.id;
    }
    const user = await tx.users.create({
        data: {
            uuid: crypto.randomUUID(),
            role: "student",
            full_name: data.fullName || null,
            mobile,
            approval_status: "approved",
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

exports.insertSchoolStudent = async (tx, studentId, data) => {
    await tx.school_students.create({
        data: {
            student_id: studentId,
            school_id: data.school_id,
            student_name: data.fullName,
            standard: data.standard,
            address: data.address,
            activities: data.activity_ids && data.activity_ids.length > 0
                ? JSON.stringify(data.activity_ids)
                : null,
        },
    });
};

// ── Pending state ──────────────────────────────────────────────────────────
exports.insertPendingRegistration = async (tempUuid, formData, serviceType) => {
    await prisma.pending_registrations.create({
        data: {
            temp_uuid: tempUuid,
            form_data: formData,
            service_type: serviceType,
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
