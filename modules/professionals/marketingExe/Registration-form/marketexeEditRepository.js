const prisma = require("../../../../config/prisma");

exports.getMEByUserId = async (userId) => {
    return await prisma.users.findUnique({
        where: { id: userId },
        include: {
            professionals: {
                include: { marketing_executives: true },
            },
        },
    });
};

exports.updateME = async (userId, userData, professionalData, meData) => {
    return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
            await tx.users.update({ where: { id: userId }, data: userData });
        }

        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { professionals: { select: { id: true, marketing_executives: { select: { id: true } } } } },
        });

        const professional = user?.professionals?.[0];
        if (!professional) throw new Error("Professional record not found");

        if (Object.keys(professionalData).length > 0) {
            await tx.professionals.update({ where: { id: professional.id }, data: professionalData });
        }

        const me = professional.marketing_executives?.[0];
        if (!me) throw new Error("Marketing executive record not found");

        if (Object.keys(meData).length > 0) {
            await tx.marketing_executives.update({ where: { id: me.id }, data: meData });
        }
    });
};
