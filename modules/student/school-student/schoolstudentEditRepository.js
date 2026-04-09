const prisma = require("../../../config/prisma");

exports.getSchoolStudentByUserId = async (userId) => {
    return await prisma.users.findUnique({
        where: { id: userId },
        include: {
            students: {
                include: { school_students: true },
            },
        },
    });
};

exports.updateSchoolStudent = async (userId, userData, schoolStudentData) => {
    return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
            await tx.users.update({ where: { id: userId }, data: userData });
        }

        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { students: { select: { id: true, school_students: { select: { id: true } } } } },
        });

        const student = user?.students?.[0];
        if (!student) throw new Error("Student record not found");

        const schoolStudent = student.school_students?.[0];
        if (!schoolStudent) throw new Error("School student record not found");

        if (Object.keys(schoolStudentData).length > 0) {
            await tx.school_students.update({ where: { id: schoolStudent.id }, data: schoolStudentData });
        }
    });
};
