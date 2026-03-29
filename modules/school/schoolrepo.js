const prisma = require("../../config/prisma");

exports.insertUser = async (tx, data) => {
    const user = await tx.users.create({
        data: {
            role: "student",
            full_name: data.principalName,
            mobile: data.principalContact,
        },
    });
    return user.id;
};

exports.insertSchool = async (tx, data, userId) => {
    const school = await tx.schools.create({
        data: {
            user_id: userId,
            school_name: data.schoolName,
            address: data.address,
            pin_code: data.pinCode,
            state: data.state,
            language_medium: data.languageMedium,
            landline_no: data.landlineNo,
            activity_coordinator: data.activityCoordinator,
            agreement_signed_by_authority: data.agreementSigned ? true : false,
        },
    });
    return school.id;
};

exports.getSchoolByName = async (schoolName) => {
    return await prisma.schools.findFirst({
        where: { school_name: { equals: schoolName, mode: "insensitive" } },
        select: { id: true },
    });
};

exports.getAllSchools = async () => {
    return await prisma.schools.findMany({
        select: { id: true, school_name: true, address: true, pin_code: true, state: true },
        orderBy: { school_name: "asc" },
    });
};
