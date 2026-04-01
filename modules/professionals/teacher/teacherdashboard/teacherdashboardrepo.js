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
                            profile_pic: true,
                        },
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
