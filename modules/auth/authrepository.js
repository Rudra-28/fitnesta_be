const prisma = require("../../config/prisma");

const findUserByMobile = async (mobile) => {
    return await prisma.users.findFirst({
        where: { mobile },
        select: {
            id: true,
            mobile: true,
            role: true,
            subrole: true,
            email: true,
            full_name: true,
            is_verified: true,
            approval_status: true,
        },
    });
};

const findUserById = async (id) => {
    return await prisma.users.findUnique({
        where: { id },
        select: {
            id: true,
            mobile: true,
            role: true,
            subrole: true,
            email: true,
            full_name: true,
            address: true,
            photo: true,
            is_verified: true,
            approval_status: true,
        },
    });
};

const findProfessionalByUserIdAndType = async (userId, professionType) => {
    return await prisma.professionals.findFirst({
        where: { user_id: userId, profession_type: professionType },
        select: { id: true },
    });
};

const findStudentByUserIdAndType = async (userId, studentType) => {
    return await prisma.students.findFirst({
        where: { user_id: userId, student_type: studentType },
        select: { id: true },
    });
};

const findProfessionalsByUserId = async (userId) => {
    return await prisma.professionals.findMany({
        where: { user_id: userId },
        select: { profession_type: true, referral_code: true },
    });
};

const findStudentsByUserId = async (userId) => {
    return await prisma.students.findMany({
        where: { user_id: userId },
        select: { student_type: true },
    });
};

// JSON_EXTRACT query — kept as raw since Prisma's query builder cannot express
// field-level JSON path conditions on a Json column
const findPendingByMobile = async (mobile) => {
    const rows = await prisma.$queryRaw`
        SELECT status, service_type
        FROM pending_registrations
        WHERE JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.contactNumber')) = ${mobile}
        LIMIT 1
    `;
    return rows.length ? rows[0] : null;
};

const markUserVerified = async (userId) => {
    await prisma.users.update({
        where: { id: userId },
        data: { is_verified: true },
    });
};

module.exports = {
    findUserByMobile,
    findUserById,
    findPendingByMobile,
    findProfessionalByUserIdAndType,
    findStudentByUserIdAndType,
    findProfessionalsByUserId,
    findStudentsByUserId,
    markUserVerified,
};
