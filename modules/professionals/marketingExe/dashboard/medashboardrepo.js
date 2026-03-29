const prisma = require("../../../../config/prisma");

// ── Shared ────────────────────────────────────────────────────────────────────
exports.findProfessionalByUserId = async (userId) => {
    return await prisma.professionals.findFirst({
        where: { user_id: userId },
        select: { id: true, referral_code: true },
    });
};

// ── Society ───────────────────────────────────────────────────────────────────
exports.societyUniqueIdExists = async (societyUniqueId) => {
    const row = await prisma.societies.findFirst({
        where: { society_unique_id: societyUniqueId },
        select: { id: true },
    });
    return !!row;
};

exports.insertSociety = async (data, meUserId, meProfessionalId) => {
    const society = await prisma.societies.create({
        data: {
            society_unique_id: data.societyUniqueId,
            registered_by_user_id: meUserId,
            me_professional_id: meProfessionalId,
            society_name: data.societyName,
            society_category: data.societyCategory ?? null,
            address: data.address,
            pin_code: data.pinCode,
            total_participants: Number(data.totalParticipants),
            no_of_flats: Number(data.noOfFlats),
            proposed_wing: data.proposedWing,
            authority_role: data.authorityRole,
            authority_person_name: data.authorityPersonName,
            contact_number: data.contactNumber,
            playground_available: data.playgroundAvailable ? true : false,
            coordinator_name: data.coordinatorName || null,
            coordinator_number: data.coordinatorNumber || null,
            agreement_signed_by_authority: data.agreementSignedByAuthority ? true : false,
            activity_agreement_pdf: data.activityAgreementPdf || null,
            approval_status: "approved",
        },
    });
    return society.id;
};

exports.getSocietiesByMe = async (meProfessionalId) => {
    return await prisma.societies.findMany({
        where: { me_professional_id: meProfessionalId },
        orderBy: { created_at: "desc" },
    });
};

exports.getSocietyById = async (societyId, meProfessionalId) => {
    return await prisma.societies.findFirst({
        where: { id: societyId, me_professional_id: meProfessionalId },
    });
};

// ── Dashboard Summary ─────────────────────────────────────────────────────────
exports.getSummary = async (meProfessionalId) => {
    const [societiesCount, schoolsCount] = await Promise.all([
        prisma.societies.count({ where: { me_professional_id: meProfessionalId } }),
        prisma.schools.count({ where: { me_professional_id: meProfessionalId } }),
    ]);
    return { societiesCount, schoolsCount };
};

// ── School ────────────────────────────────────────────────────────────────────
exports.schoolNameExists = async (schoolName) => {
    const row = await prisma.schools.findFirst({
        where: { school_name: { equals: schoolName, mode: "insensitive" } },
        select: { id: true },
    });
    return !!row;
};

exports.insertPrincipalUser = async (tx, data) => {
    const user = await tx.users.create({
        data: {
            role: "student",
            full_name: data.principalName,
            mobile: data.principalContact,
        },
    });
    return user.id;
};

exports.insertSchool = async (tx, data, userId, meProfessionalId) => {
    const school = await tx.schools.create({
        data: {
            user_id: userId,
            me_professional_id: meProfessionalId,
            school_name: data.schoolName,
            address: data.address,
            pin_code: data.pinCode,
            state: data.state,
            language_medium: data.languageMedium || null,
            landline_no: data.landlineNo || null,
            principal_name: data.principalName,
            principal_contact: data.principalContact,
            activity_coordinator: data.activityCoordinator || null,
            agreement_signed_by_authority: data.agreementSignedByAuthority ? true : false,
            activity_agreement_pdf: data.activityAgreementPdf || null,
            approval_status: "approved",
        },
    });
    return school.id;
};

exports.getSchoolsByMe = async (meProfessionalId) => {
    return await prisma.schools.findMany({
        where: { me_professional_id: meProfessionalId },
        orderBy: { created_at: "desc" },
    });
};

exports.getSchoolById = async (schoolId, meProfessionalId) => {
    return await prisma.schools.findFirst({
        where: { id: schoolId, me_professional_id: meProfessionalId },
    });
};
