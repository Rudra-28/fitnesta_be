const prisma = require("../../../config/prisma");

exports.getTrainerByUserId = async (userId) => {
    return await prisma.users.findUnique({
        where: { id: userId },
        include: {
            professionals: {
                include: { trainers: true },
            },
        },
    });
};

exports.updateTrainer = async (userId, userData, professionalData, trainerData) => {
    return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
            await tx.users.update({ where: { id: userId }, data: userData });
        }

        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { professionals: { select: { id: true, trainers: { select: { id: true } } } } },
        });

        const professional = user?.professionals?.[0];
        if (!professional) throw new Error("Professional record not found");

        if (Object.keys(professionalData).length > 0) {
            await tx.professionals.update({ where: { id: professional.id }, data: professionalData });
        }

        const trainer = professional.trainers?.[0];
        if (!trainer) throw new Error("Trainer record not found");

        if (Object.keys(trainerData).length > 0) {
            await tx.trainers.update({ where: { id: trainer.id }, data: trainerData });
        }
    });
};
