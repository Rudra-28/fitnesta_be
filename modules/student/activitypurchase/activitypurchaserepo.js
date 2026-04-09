const prisma = require("../../../config/prisma");

// ── Lookup helpers ─────────────────────────────────────────────────────────

exports.getApprovedSocieties = async () => {
    return prisma.societies.findMany({
        where:   { approval_status: "approved" },
        select:  { id: true, society_name: true, society_category: true },
        orderBy: { society_name: "asc" },
    });
};

exports.getApprovedSchools = async () => {
    return prisma.schools.findMany({
        where:   { approval_status: "approved" },
        select:  { id: true, school_name: true },
        orderBy: { school_name: "asc" },
    });
};

exports.getSocietyById = async (id) => {
    return prisma.societies.findUnique({
        where:  { id },
        select: { id: true, society_name: true, society_category: true, me_professional_id: true },
    });
};

exports.getSchoolById = async (id) => {
    return prisma.schools.findUnique({
        where:  { id },
        select: { id: true, school_name: true, me_professional_id: true },
    });
};

// ── Student lookup ─────────────────────────────────────────────────────────

exports.getStudentByUserId = async (userId) => {
    return prisma.students.findFirst({
        where:  { user_id: userId },
        select: { id: true, student_type: true },
    });
};

// ── On finalize: write participant records ─────────────────────────────────

/**
 * Insert an individual_participants row for an existing student.
 * Used for both individual_coaching and group_coaching add-on purchases.
 */
exports.insertIndividualParticipant = async (tx, studentId, data, termMonths) => {
    return tx.individual_participants.create({
        data: {
            student_id:      studentId,
            flat_no:         data.flat_no          || null,
            dob:             data.dob ? new Date(data.dob) : null,
            age:             data.age ? parseInt(data.age) : null,
            society_id:      data.society_id ? parseInt(data.society_id) : null,
            society_name:    data.society_name     || null,
            activity:        data.activity_label   || null,  // human-readable summary
            kits:            data.kit_type         || null,
            preferred_batch: data.preferred_batch  || null,
            term_months:     termMonths,
        },
    });
};

/**
 * Insert a school_students row for an existing student.
 */
exports.insertSchoolParticipant = async (tx, studentId, schoolId, data) => {
    return tx.school_students.create({
        data: {
            student_id:   studentId,
            school_id:    schoolId,
            student_name: data.student_name || null,
            standard:     data.standard     || null,
            activities:   data.activity_label || null,
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

// ── Batch auto-assign (mirrors indicoachservice logic) ─────────────────────

exports.findAvailableBatch = async (societyId, activityId) => {
    const batches = await prisma.batches.findMany({
        where: {
            batch_type:  "group_coaching",
            society_id:  societyId,
            activity_id: activityId,
            is_active:   true,
        },
        include: { _count: { select: { batch_students: true } } },
        orderBy: { created_at: "asc" },
    });
    return batches.find((b) => b._count.batch_students < b.capacity) ?? null;
};

exports.assignStudentToBatch = async (batchId, studentId) => {
    await prisma.batch_students.create({ data: { batch_id: batchId, student_id: studentId } });
};

exports.addStudentToFutureSessions = async (batchId, studentId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureSessions = await prisma.sessions.findMany({
        where: {
            batch_id:       batchId,
            scheduled_date: { gte: today },
            status:         { in: ["scheduled", "ongoing"] },
        },
        select: { id: true },
    });
    if (futureSessions.length > 0) {
        await prisma.session_participants.createMany({
            data:           futureSessions.map((s) => ({ session_id: s.id, student_id: studentId })),
            skipDuplicates: true,
        });
    }
};
