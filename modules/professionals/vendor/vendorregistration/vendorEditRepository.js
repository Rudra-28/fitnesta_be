const prisma = require("../../../../config/prisma");

exports.getVendorByUserId = async (userId) => {
    return await prisma.users.findUnique({
        where: { id: userId },
        include: {
            professionals: {
                include: { vendors: true },
            },
        },
    });
};

exports.updateVendor = async (userId, userData, professionalData, vendorData) => {
    return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length > 0) {
            await tx.users.update({ where: { id: userId }, data: userData });
        }

        const user = await tx.users.findUnique({
            where: { id: userId },
            select: { professionals: { select: { id: true, vendors: { select: { id: true } } } } },
        });

        const professional = user?.professionals?.[0];
        if (!professional) throw new Error("Professional record not found");

        if (Object.keys(professionalData).length > 0) {
            await tx.professionals.update({ where: { id: professional.id }, data: professionalData });
        }

        const vendor = professional.vendors?.[0];
        if (!vendor) throw new Error("Vendor record not found");

        if (Object.keys(vendorData).length > 0) {
            await tx.vendors.update({ where: { id: vendor.id }, data: vendorData });
        }
    });
};
