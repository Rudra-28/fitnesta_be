const prisma = require("../../../config/prisma");
const crypto = require("crypto");

// ── STEP 1: Stage submission ──────────────────────────────────────────────
exports.insertPending = async (data) => {
    const tempUuid = crypto.randomUUID();
    await prisma.pending_registrations.create({
        data: {
            temp_uuid: tempUuid,
            form_data: data,
            service_type: "trainer",
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
            subrole: "trainer",
            full_name: data.fullName,
            mobile: data.contactNumber,
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
            profession_type: "trainer",
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

exports.insertTrainer = async (tx, data, professionalId) => {
    const trainer = await tx.trainers.create({
        data: {
            professional_id: professionalId,
            player_level: data.playerLevel ?? null,
            category: data.category ?? null,
            // Prisma knows these are Json columns
            specified_game: data.specifiedGame ?? [],
            specified_skills: data.specifiedSkills ?? [],
            experience_details: data.experienceDetails ?? null,
            qualification_docs: data.qualificationDocs ?? null,
            documents: data.documents ?? null,
        },
    });
    return trainer.id;
};
