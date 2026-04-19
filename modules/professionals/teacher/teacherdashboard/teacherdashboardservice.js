const repo              = require("./teacherdashboardrepo");
const commissionRepo    = require("../../../commissions/commissionrepo");

// Resolve professional id from JWT userId, throw if not found
const resolveTeacher = async (userId) => {
    const professional = await repo.findTeacherByUserId(userId);
    if (!professional) throw new Error("Teacher profile not found for this user.");
    return professional.id;
};

// Build one card per subject within a personal_tutors row.
// sessions must already be filtered to only those belonging to this subject.
const formatStudentCard = (row, subjectName, sessions) => {
    const totalSessions     = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === "completed").length;
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    return {
        tutorRecordId: row.id,
        standard:      row.standard,
        batch:         row.batch ?? null,
        subject:       subjectName,
        dob:           row.dob ?? null,
        studentId:     row.students?.id ?? null,
        fullName:      row.students?.users?.full_name ?? null,
        mobile:        row.students?.users?.mobile ?? null,
        email:         row.students?.users?.email ?? null,
        profilePic:    row.students?.users?.photo ?? null,
        sessionProgress: {
            completed:  completedSessions,
            total:      totalSessions,
            percentage: progress,
        },
    };
};

// ── GET /summary ─────────────────────────────────────────────────────────────
// Returns total student count + per-standard breakdown
exports.getSummary = async (userId) => {
    const professionalId = await resolveTeacher(userId);
    const counts = await repo.countStudentsByStandard(professionalId);

    // Build a map for fast lookup
    const countMap = {};
    let total = 0;
    for (const row of counts) {
        const std = row.standard ?? "ANY";
        countMap[std] = row._count.id;
        total += row._count.id;
    }

    const breakdown = repo.ALL_STANDARDS.map((std) => ({
        standard: std,
        count: countMap[std] ?? 0,
    }));

    return {
        success: true,
        data: {
            totalStudents: total,
            breakdown,
        },
    };
};

// ── GET /students ─────────────────────────────────────────────────────────────
// Returns one card per subject per student, optionally filtered by ?standard=5TH-6TH
exports.getStudents = async (userId, standard) => {
    const professionalId = await resolveTeacher(userId);

    const VALID = [...repo.ALL_STANDARDS, "ALL"];
    if (standard && !VALID.includes(standard.toUpperCase())) {
        throw new Error(`Invalid standard. Allowed values: ${VALID.join(", ")}.`);
    }

    const normalised = standard ? standard.toUpperCase() : "ALL";
    const rows = await repo.findStudentsByTeacher(professionalId, normalised);

    // Expand each personal_tutors row into one card per subject with isolated session counts
    const cards = [];
    for (const row of rows) {
        const studentId   = row.students?.id ?? null;
        const teacherFor  = row.teacher_for ?? "";

        // Split comma-separated subjects — each gets its own card
        const subjects = teacherFor.split(",").map((s) => s.trim()).filter(Boolean);

        if (subjects.length === 0) {
            // No subjects recorded — emit one card with empty progress
            cards.push(formatStudentCard(row, null, []));
            continue;
        }

        for (const subjectName of subjects) {
            let sessions = [];
            if (studentId) {
                const result = await repo.getSessionsForStudentBySubjects(
                    professionalId, studentId, [subjectName]
                );
                sessions = result.sessions;
            }
            cards.push(formatStudentCard(row, subjectName, sessions));
        }
    }

    // When fetching ALL, group by standard for convenience
    if (normalised === "ALL") {
        const grouped = {};
        for (const std of repo.ALL_STANDARDS) grouped[std] = [];

        for (const card of cards) {
            const key = card.standard ?? "ANY";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(card);
        }

        return { success: true, total: cards.length, data: grouped };
    }

    return { success: true, standard: normalised, total: cards.length, data: cards };
};

// ── GET /sessions/:id ─────────────────────────────────────────────────────────
exports.getSessionById = async (userId, sessionId) => {
    const professionalId = await resolveTeacher(userId);
    const session = await repo.getSessionById(sessionId, professionalId);
    if (!session) throw Object.assign(new Error("Session not found"), { code: "NOT_FOUND" });
    return { success: true, data: session };
};

// ── GET /subjects ─────────────────────────────────────────────────────────────
exports.getSubjects = async (userId) => {
    const professionalId = await resolveTeacher(userId);
    const data = await repo.getSubjectsWithStudentStats(professionalId);
    return { success: true, total_subjects: data.length, data };
};

// ── GET /students/:tutorRecordId ──────────────────────────────────────────────
exports.getStudentDetail = async (userId, tutorRecordId) => {
    const professionalId = await resolveTeacher(userId);
    const row = await repo.getStudentDetail(tutorRecordId, professionalId);
    if (!row) throw Object.assign(new Error("Student not found"), { code: "NOT_FOUND" });
    return { success: true, data: row };
};

// ── GET /sessions?status=upcoming|ongoing|history ─────────────────────────────
const VALID_STATUSES = ["upcoming", "ongoing", "completed", "cancelled"];

exports.getSessions = async (userId, status = "upcoming") => {
    if (!VALID_STATUSES.includes(status)) {
        throw Object.assign(new Error(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`), { code: "BAD_REQUEST" });
    }
    const professionalId = await resolveTeacher(userId);
    const sessions = await repo.getSessions(professionalId, status);
    return { success: true, data: sessions };
};


// ── POST /sessions/:id/start ──────────────────────────────────────────────────
exports.startSession = async (userId, sessionId) => {
    const professionalId = await resolveTeacher(userId);
    const session = await repo.getSessionById(sessionId, professionalId);
    if (!session) throw Object.assign(new Error("Session not found or not yours"), { code: "NOT_FOUND" });
    if (session.status !== "scheduled") throw Object.assign(new Error("Session already started or completed"), { code: "CONFLICT" });
    const updated = await repo.startSession(sessionId, professionalId);
    return { success: true, data: updated };
};

// ── POST /sessions/:id/end ────────────────────────────────────────────────────
exports.endSession = async (userId, sessionId) => {
    const professionalId = await resolveTeacher(userId);
    const prisma = require("../../../../config/prisma");
    const session = await prisma.sessions.findFirst({
        where: { id: Number(sessionId), professional_id: professionalId },
        select: { id: true, status: true },
    });
    if (!session) throw Object.assign(new Error("Session not found or not yours"), { code: "NOT_FOUND" });
    if (session.status !== "ongoing") throw Object.assign(new Error("Session is not ongoing"), { code: "CONFLICT" });
    const updated = await repo.endSession(sessionId, professionalId);
    return { success: true, data: updated };
};

const VALID_WALLET_STATUSES = ["pending", "approved", "paid"];

exports.getWalletSummary = async (userId) => {
    const professionalId = await resolveTeacher(userId);
    return commissionRepo.getWalletSummary(professionalId);
};

exports.getWalletBreakdown = async (userId, status) => {
    if (!VALID_WALLET_STATUSES.includes(status))
        throw Object.assign(new Error(`Invalid status. Allowed: ${VALID_WALLET_STATUSES.join(", ")}`), { statusCode: 400 });
    return commissionRepo.getWalletBreakdown(await resolveTeacher(userId), status);
};

exports.getTransactionHistory = async (userId, filters) => {
    return commissionRepo.getTransactionHistory(await resolveTeacher(userId), filters);
};

