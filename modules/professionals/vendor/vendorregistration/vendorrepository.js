const prisma = require("../../../../config/prisma");
const crypto = require("crypto");

// ── STEP 1: Stage submission ──────────────────────────────────────────────
exports.insertPending = async (data) => {
    const tempUuid = crypto.randomUUID();
    await prisma.pending_registrations.create({
        data: {
            temp_uuid: tempUuid,
            form_data: data,
            service_type: "vendor",
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
            subrole: "vendor",
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
            profession_type: "vendor",
            pan_card: data.panCard ?? null,
            adhar_card: data.adharCard ?? null,
        },
    });
    return professional.id;
};

exports.insertVendors = async (tx, data, professionalId) => {
    await tx.vendors.create({
        data: {
            professional_id: professionalId,
            store_name: data.storeName ?? null,
            store_address: data.storeAddress ?? null,
            store_location: data.storeLocation ?? null,
            gst_certificate: data.GSTCertificate ?? null,
        },
    });
};

exports.getAllVendors = async () => {
    return await prisma.vendors.findMany({
        include: {
            professionals: {
                include: { users: true },
            },
        },
    });
};
