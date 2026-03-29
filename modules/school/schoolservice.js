const prisma = require("../../config/prisma");
const repo = require("./schoolrepo");

exports.registerSchool = async (data) => {
    const result = await prisma.$transaction(async (tx) => {
        const userId   = await repo.insertUser(tx, data);
        const schoolId = await repo.insertSchool(tx, data, userId);
        return { schoolId, userId };
    });
    return result;
};

exports.getSchools = async () => {
    return await repo.getAllSchools();
};
