const prisma = require("../../../config/prisma");

exports.getICByUserId = async (userId) => {
    return await prisma.users.findUnique({
        where: { id: userId },
        include: {
            students: {
                include: { individual_participants: true },
            },
        },
    });
};

exports.updateIC = async (userId, userData, participantData) => {
    return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
            await tx.users.update({ where: { id: userId }, data: userData });
        }

        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { students: { select: { id: true, individual_participants: { select: { id: true } } } } },
        });

        const student = user?.students?.[0];
        if (!student) throw new Error("Student record not found");

        const participant = student.individual_participants?.[0];
        if (!participant) throw new Error("Individual coaching record not found");

        if (Object.keys(participantData).length > 0) {
            await tx.individual_participants.update({ where: { id: participant.id }, data: participantData });
        }
    });
};
