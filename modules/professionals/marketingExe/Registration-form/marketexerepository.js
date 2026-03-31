const prisma = require("../../../../config/prisma");
const crypto = require("crypto");

// ── STEP 1: Stage submission ──────────────────────────────────────────────
exports.insertPending = async (data) => {
    const tempUuid = crypto.randomUUID();
    await prisma.pending_registrations.create({
        data: {
            temp_uuid: tempUuid,
            form_data: data,
            service_type: "marketing_executive",
            status: "pending",
        },
    });
    return tempUuid;
};

// ── STEP 2: Called inside a Prisma transaction on admin approval ──────────
exports.insertUser = async (tx, data) => {
    const uuid = crypto.randomUUID();
    const user = await tx.users.create({
        data: {
            uuid,
            role: "professional",
            subrole: "marketing_executive",
            full_name: data.fullName ?? null,
            mobile: data.contactNumber ?? null,
            email: data.email ?? null,
            address: data.address ?? null,
            photo: data.photo ?? null,
            approval_status: "approved",
        },
    });
    return { id: user.id, uuid };
};

exports.insertProfessional = async (tx, data, userId, uuid) => {
    const referralCode = "FIT-" + uuid.replace(/-/g, "").substring(0, 8).toUpperCase();

    const professional = await tx.professionals.create({
        data: {
            referral_code: referralCode,
            user_id: userId,
            profession_type: "marketing_executive",
            pan_card: data.panCard ?? null,
            adhar_card: data.adharCard ?? null,
            relative_name: data.relativeName ?? null,
            relative_contact: data.relativeContact ?? null,
            own_two_wheeler: data.ownTwoWheeler ? true : false,
            // TEXT column in DB — stored as JSON string
            communication_languages: JSON.stringify(data.communicationLanguages ?? []),
            place: data.place ?? null,
            date: data.date ? new Date(data.date) : null,
        },
    });
    return professional.id;
};

exports.insertMarketexe = async (tx, data, professionalId) => {
    const me = await tx.marketing_executives.create({
        data: {
            professional_id: professionalId,
            dob: data.dob ? new Date(data.dob) : null,
            education_qualification: data.educationQualification ?? null,
            previous_experience: data.previousExperience ?? null,
            activity_agreement_pdf: data.activityAgreementsPdf ?? null,
        },
    });
    return me.id;
};

exports.getAllMarketexe = async () => {
    return await prisma.marketing_executives.findMany({
        include: {
            professionals: {
                include: { users: true },
            },
        },
    });
};
