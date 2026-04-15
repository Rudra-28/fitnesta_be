const prisma = require("../../../config/prisma");

// ── Lookup helpers ─────────────────────────────────────────────────────────

/**
 * Returns all distinct standards that exist in fee_structures for personal_tutor.
 */
exports.getPersonalTutorStandards = async () => {
    const rows = await prisma.fee_structures.findMany({
        where: {
            coaching_type: "personal_tutor",
            standard: { not: null },
        },
        select:   { standard: true },
        distinct: ["standard"],
        orderBy:  { standard: "asc" },
    });
    return rows.map((r) => r.standard);
};

/**
 * Returns all personal_tutor fee rows for a given standard (or "ANY"),
 * including activity name.
 */
exports.getSubjectsForStandard = async (standard) => {
    return prisma.fee_structures.findMany({
        where: {
            coaching_type: "personal_tutor",
            standard: { in: [standard, "ANY"].filter(Boolean) },
        },
        include: { activities: { select: { id: true, name: true } } },
        orderBy: [{ activity_id: "asc" }, { term_months: "asc" }],
    });
};

// ── Student lookup ─────────────────────────────────────────────────────────

exports.getStudentByUserId = async (userId) => {
    return prisma.students.findFirst({
        where:  { user_id: userId },
        select: { id: true, student_type: true },
    });
};

/**
 * Returns an active personal_tutors row for this student if one already exists.
 * Used to block duplicate enrollment.
 */
exports.getActivePersonalTutor = async (studentId) => {
    return prisma.personal_tutors.findFirst({
        where:  { student_id: studentId, is_active: true },
        select: { id: true },
    });
};

// ── Finalize: write personal_tutors row ────────────────────────────────────

/**
 * Creates a new personal_tutors row for an existing student.
 * Called inside a Prisma transaction.
 */
exports.insertPersonalTutor = async (tx, studentId, data, termMonths) => {
    return tx.personal_tutors.create({
        data: {
            student_id:   studentId,
            standard:     data.standard      || null,
            teacher_for:  data.teacher_for   || null,
            batch:        data.batch         || null,
            preferred_time: data.preferred_time || null,
            term_months:  termMonths,
        },
    });
};

// ── Pending registration ───────────────────────────────────────────────────

exports.insertPendingRegistration = async (tempUuid, formData, serviceType) => {
    await prisma.pending_registrations.create({
        data: {
            temp_uuid:    tempUuid,
            form_data:    formData,
            service_type: serviceType,
            status:       "pending",
        },
    });
};

exports.getPendingByUuid = async (tempUuid) => {
    return prisma.pending_registrations.findFirst({
        where: { temp_uuid: tempUuid, status: "pending" },
    });
};

exports.updatePendingStatus = async (id, status) => {
    return prisma.pending_registrations.update({
        where: { id },
        data:  { status },
    });
};
