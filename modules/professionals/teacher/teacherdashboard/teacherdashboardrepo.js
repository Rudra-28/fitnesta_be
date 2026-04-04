const prisma = require("../../../../config/prisma");

// Resolve teacher's professional record from their JWT userId
exports.findTeacherByUserId = async (userId) => {
    const professional = await prisma.professionals.findFirst({
        where: { user_id: userId, profession_type: "teacher" },
        select: { id: true },
    });
    return professional ?? null;
};

// All standards in the defined order for consistent response shape
const ALL_STANDARDS = ["1ST-2ND", "3RD-4TH", "5TH-6TH", "7TH-8TH", "8TH-10TH", "ANY"];

exports.ALL_STANDARDS = ALL_STANDARDS;

// Fetch all personal_tutors assigned to this teacher, with student user info
exports.findStudentsByTeacher = async (professionalId, standard) => {
    return await prisma.personal_tutors.findMany({
        where: {
            teacher_professional_id: professionalId,
            ...(standard && standard !== "ALL" ? { standard } : {}),
        },
        select: {
            id: true,
            standard: true,
            batch: true,
            teacher_for: true,
            dob: true,
            students: {
                select: {
                    id: true,
                    users: {
                        select: {
                            full_name: true,
                            mobile: true,
                            email: true,
                            photo: true,
                        },
                    },
                    sessions: {
                        where: { professional_id: professionalId },
                        select: { status: true },
                    },
                },
            },
        },
        orderBy: { id: "asc" },
    });
};

// Count students per standard for the summary card
exports.countStudentsByStandard = async (professionalId) => {
    const rows = await prisma.personal_tutors.groupBy({
        by: ["standard"],
        where: { teacher_professional_id: professionalId },
        _count: { id: true },
    });
    return rows; // [{ standard: "5TH-6TH", _count: { id: 3 } }, ...]
};

// ── Subjects grouped view (mirrors "Total Activities" screen for teacher) ─────
// Groups personal_tutor students by subject (teacher_for field)
// Each subject card shows: student count + session stats
exports.getSubjectsWithStudentStats = async (professionalId) => {
    const rows = await prisma.personal_tutors.findMany({
        where: { teacher_professional_id: professionalId },
        select: {
            id: true,
            standard: true,
            batch: true,
            teacher_for: true,
            dob: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true, email: true, photo: true } },
                    sessions: {
                        where: { professional_id: professionalId },
                        select: { status: true },
                    },
                },
            },
        },
    });

    const subjectMap = {};
    for (const row of rows) {
        const subject = row.teacher_for ?? "General";
        if (!subjectMap[subject]) {
            subjectMap[subject] = { subject, total_students: 0, total_sessions: 0, completed_sessions: 0, pending_sessions: 0, students: [] };
        }
        const sessions   = row.students?.sessions ?? [];
        const completed  = sessions.filter((s) => s.status === "completed").length;
        const pending    = sessions.filter((s) => s.status === "scheduled" || s.status === "ongoing").length;
        subjectMap[subject].total_students++;
        subjectMap[subject].total_sessions    += sessions.length;
        subjectMap[subject].completed_sessions += completed;
        subjectMap[subject].pending_sessions   += pending;
        subjectMap[subject].students.push({
            tutor_record_id: row.id,
            student_id:  row.students?.id ?? null,
            full_name:   row.students?.users?.full_name ?? null,
            mobile:      row.students?.users?.mobile ?? null,
            email:       row.students?.users?.email ?? null,
            photo:       row.students?.users?.photo ?? null,
            standard:    row.standard,
            batch:       row.batch ?? null,
            dob:         row.dob ?? null,
        });
    }
    return Object.values(subjectMap);
};

// Single student detail by personal_tutor record id
exports.getStudentDetail = async (tutorRecordId, professionalId) => {
    return prisma.personal_tutors.findFirst({
        where: { id: Number(tutorRecordId), teacher_professional_id: professionalId },
        select: {
            id: true,
            standard: true,
            batch: true,
            teacher_for: true,
            dob: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true, email: true, photo: true, address: true } },
                    sessions: {
                        where: { professional_id: professionalId },
                        select: { id: true, scheduled_date: true, start_time: true, end_time: true, status: true },
                        orderBy: { scheduled_date: "desc" },
                    },
                },
            },
        },
    });
};

// ── Session queries ───────────────────────────────────────────────────────────

exports.getSessions = async (professionalId, status) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const whereMap = {
        upcoming:  { scheduled_date: { gte: today }, status: { in: ["scheduled", "ongoing"] } },
        ongoing:   { status: "ongoing" },
        completed: { status: "completed" },
        cancelled: { status: "cancelled" },
    };

    const descOrder = ["completed", "cancelled"].includes(status);

    return prisma.sessions.findMany({
        where: { professional_id: Number(professionalId), ...(whereMap[status] ?? whereMap.upcoming) },
        include: {
            batches:  { select: { id: true, batch_name: true, batch_type: true, schools: { select: { id: true, school_name: true } }, activities: { select: { id: true, name: true } } } },
            students: { select: { id: true, users: { select: { full_name: true, mobile: true } } } },
            _count:   { select: { session_participants: true } },
        },
        orderBy: descOrder
            ? [{ scheduled_date: "desc" }, { start_time: "desc" }]
            : [{ scheduled_date: "asc"  }, { start_time: "asc"  }],
    });
};

exports.getSessionById = async (sessionId, professionalId) => {
    return prisma.sessions.findFirst({
        where: { id: Number(sessionId), professional_id: Number(professionalId) },
        include: {
            batches: {
                select: {
                    id: true, batch_name: true, batch_type: true,
                    activities: { select: { id: true, name: true } },
                    schools:    { select: { id: true, school_name: true } },
                    _count:     { select: { batch_students: true } },
                },
            },
            students: {
                select: { id: true, users: { select: { full_name: true, mobile: true, email: true, photo: true } } },
            },
            session_participants: {
                select: {
                    attended: true,
                    students: { select: { id: true, users: { select: { full_name: true, photo: true } } } },
                },
            },
            session_feedback: {
                select: { rating: true, comment: true, students: { select: { id: true, users: { select: { full_name: true } } } } },
            },
            _count: { select: { session_participants: true } },
        },
    });
};

exports.startSession = async (sessionId, professionalId) => {
    return prisma.sessions.update({
        where: { id: Number(sessionId) },
        data: { status: "ongoing", in_time: new Date(), updated_at: new Date() },
    });
};

exports.endSession = async (sessionId, professionalId) => {
    return prisma.sessions.update({
        where: { id: Number(sessionId) },
        data: { status: "completed", out_time: new Date(), updated_at: new Date() },
    });
};

exports.getSessionHistory = async (professionalId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.sessions.findMany({
        where: {
            professional_id: Number(professionalId),
            OR: [
                { scheduled_date: { lt: today } },
                { status: { in: ["completed", "cancelled"] } },
            ],
        },
        include: {
            batches: {
                select: { id: true, batch_name: true, batch_type: true },
            },
            students: {
                select: { id: true, users: { select: { full_name: true } } },
            },
            _count: { select: { session_participants: true } },
        },
        orderBy: [{ scheduled_date: "desc" }, { start_time: "desc" }],
    });
};
