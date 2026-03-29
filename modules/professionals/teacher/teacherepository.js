const prisma = require("../../../config/prisma");
const crypto = require("crypto");

// ── STEP 1: Stage submission ──────────────────────────────────────────────
exports.insertPending = async (data) => {
    const tempUuid = crypto.randomUUID();
    await prisma.pending_registrations.create({
        data: {
            temp_uuid: tempUuid,
            form_data: data,
            service_type: "teacher",
            status: "pending",
        },
    });
    return tempUuid;
};

// ── STEP 2: Called inside a Prisma transaction on admin approval ──────────
exports.insertUser = async (tx, data) => {
    const user = await tx.users.create({
        data: {
            role: "professional",
            subrole: "teacher",
            full_name: data.fullName,
            mobile: data.contactNumber,
            email: data.email ?? null,
            address: data.address ?? null,
            approval_status: "approved",
        },
    });
    return user.id;
};

exports.insertProfessional = async (tx, data, userId) => {
    const uuid = crypto.randomUUID();
    const referralCode = "FIT-" + uuid.replace(/-/g, "").substring(0, 8).toUpperCase();

    const professional = await tx.professionals.create({
        data: {
            uuid,
            referral_code: referralCode,
            user_id: userId,
            profession_type: "teacher",
            pan_card: data.panCard ?? null,
            adhar_card: data.adharCard ?? null,
            relative_name: data.relativeName ?? null,
            relative_contact: data.relativeContact ?? null,
            own_two_wheeler: data.ownTwoWheeler ?? false,
            // TEXT column in DB — stored as JSON string
            communication_languages: JSON.stringify(data.communicationLanguages ?? []),
            place: data.place ?? null,
            date: data.date ? new Date(data.date) : null,
        },
    });
    return professional.id;
};

exports.insertTeacher = async (tx, data, professionalId) => {
    const teacher = await tx.teachers.create({
        data: {
            professional_id: professionalId,
            subject: data.subject ?? null,
            experience_details: data.experienceDetails ?? null,
            ded_doc: data.dedDoc ?? null,
            bed_doc: data.bedDoc ?? null,
            other_doc: data.otherDoc ?? null,
        },
    });
    return teacher.id;
};
