const repo = require("./teacherdashboardrepo");

// Resolve professional id from JWT userId, throw if not found
const resolveTeacher = async (userId) => {
    const professional = await repo.findTeacherByUserId(userId);
    if (!professional) throw new Error("Teacher profile not found for this user.");
    return professional.id;
};

// Normalise a personal_tutors row into a clean student object
const formatStudent = (row) => ({
    tutorRecordId: row.id,
    standard: row.standard,
    batch: row.batch ?? null,
    subject: row.teacher_for ?? null,
    dob: row.dob ?? null,
    studentId: row.students?.id ?? null,
    fullName: row.students?.users?.full_name ?? null,
    mobile: row.students?.users?.mobile ?? null,
    email: row.students?.users?.email ?? null,
    profilePic: row.students?.users?.profile_pic ?? null,
});

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
// Returns students, optionally filtered by ?standard=5TH-6TH
// standard=ALL (or omitted) returns every student
exports.getStudents = async (userId, standard) => {
    const professionalId = await resolveTeacher(userId);

    const VALID = [...repo.ALL_STANDARDS, "ALL"];
    if (standard && !VALID.includes(standard.toUpperCase())) {
        throw new Error(
            `Invalid standard. Allowed values: ${VALID.join(", ")}.`
        );
    }

    const normalised = standard ? standard.toUpperCase() : "ALL";
    const rows = await repo.findStudentsByTeacher(professionalId, normalised);
    const students = rows.map(formatStudent);

    // When fetching ALL, group by standard for convenience
    if (normalised === "ALL") {
        const grouped = {};
        for (const std of repo.ALL_STANDARDS) grouped[std] = [];

        for (const s of students) {
            const key = s.standard ?? "ANY";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(s);
        }

        return {
            success: true,
            total: students.length,
            data: grouped,
        };
    }

    return {
        success: true,
        standard: normalised,
        total: students.length,
        data: students,
    };
};
