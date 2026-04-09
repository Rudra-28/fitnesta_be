const prisma = require("../../../config/prisma");

exports.getPTByUserId = async (userId) => {
    return await prisma.users.findUnique({
        where: { id: userId },
        include: {
            students: {
                include: { personal_tutors: true },
            },
        },
    });
};

exports.updatePT = async (userId, userData, ptData) => {
    return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
            await tx.users.update({ where: { id: userId }, data: userData });
        }

        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { students: { select: { id: true, personal_tutors: { select: { id: true } } } } },
        });

        const student = user?.students?.[0];
        if (!student) throw new Error("Student record not found");

        const pt = student.personal_tutors?.[0];
        if (!pt) throw new Error("Personal tutor record not found");

        if (Object.keys(ptData).length > 0) {
            await tx.personal_tutors.update({ where: { id: pt.id }, data: ptData });
        }
    });
};
