const prisma = require("../../../config/prisma");

exports.getTeacherByUserId = async (userId) => {
    return await prisma.users.findUnique({
        where: { id: userId },
        include: {
            professionals: {
                include: { teachers: true },
            },
        },
    });
};

exports.updateTeacher = async (userId, userData, professionalData, teacherData) => {
    return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
            await tx.users.update({ where: { id: userId }, data: userData });
        }

        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { professionals: { select: { id: true, teachers: { select: { id: true } } } } },
        });

        const professional = user?.professionals?.[0];
        if (!professional) throw new Error("Professional record not found");

        if (Object.keys(professionalData).length > 0) {
            await tx.professionals.update({ where: { id: professional.id }, data: professionalData });
        }

        const teacher = professional.teachers?.[0];
        if (!teacher) throw new Error("Teacher record not found");

        if (Object.keys(teacherData).length > 0) {
            await tx.teachers.update({ where: { id: teacher.id }, data: teacherData });
        }
    });
};
