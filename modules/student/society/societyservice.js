const prisma = require("../../../config/prisma");
const repo = require("./societyrepo");

exports.registerSociety = async (data) => {
    const serviceType = data.hasSignedAgreement ? "society_enrollment" : "society_request";

    const duplicate = await repo.findBySocietyUniqueId(data.societyUniqueId);

    if (duplicate.exists) {
        if (duplicate.where === "approved") {
            const err = new Error("A society with this ID is already registered.");
            err.statusCode = 409;
            throw err;
        }
        if (duplicate.serviceType === "society_enrollment") {
            const err = new Error("An enrollment for this Society ID is already pending admin approval.");
            err.statusCode = 409;
            throw err;
        }
        if (duplicate.serviceType === "society_request" && !data.hasSignedAgreement) {
            const err = new Error("A registration request for this Society ID is already pending approval.");
            err.statusCode = 409;
            throw err;
        }
    }

    if (data.hasSignedAgreement) {
        const professional = await repo.findProfessionalByReferralCode(null, data.referralCode);
        if (!professional) {
            const err = new Error("Invalid referral code. No Fitness Coordinator found with this code.");
            err.statusCode = 400;
            throw err;
        }
        await repo.cancelPendingRequest(data.societyUniqueId);
    }

    const tempUuid = await repo.insertPending(data, serviceType);

    return {
        success: true,
        tempUuid,
        message: data.hasSignedAgreement
            ? "Society enrollment submitted. Awaiting approval."
            : "Society registration request submitted. Awaiting admin approval.",
    };
};

const SOCIETY_CATEGORY_DISPLAY = { A_: "A+", A: "A", B: "B" };

exports.getSocieties = async () => {
    const societies = await repo.getAllSocieties();
    return societies.map((s) => ({
        ...s,
        society_category: s.society_category
            ? (SOCIETY_CATEGORY_DISPLAY[s.society_category] ?? s.society_category)
            : null,
    }));
};

// ── helpers ────────────────────────────────────────────────────────────────
const mapPending = (rows) =>
    rows.map((r) => ({
        id: r.id,
        tempUuid: r.temp_uuid,
        serviceType: r.service_type,
        submittedAt: r.created_at,
        formData: r.form_data,
    }));

const assertPending = async (pendingId, expectedType) => {
    const pending = await repo.getPendingById(pendingId);
    if (!pending) { const err = new Error("PENDING_NOT_FOUND"); err.statusCode = 404; throw err; }
    if (pending.status !== "pending") { const err = new Error("ALREADY_REVIEWED"); err.statusCode = 409; throw err; }
    if (pending.service_type !== expectedType) {
        const err = new Error(`Expected a ${expectedType} entry, got ${pending.service_type}.`);
        err.statusCode = 400;
        throw err;
    }
    return pending;
};

// ── Admin: society_request ─────────────────────────────────────────────────
exports.listPendingRequests = async () => mapPending(await repo.getPendingRequests());

exports.approveRequestByAdmin = async (pendingId, adminUserId, note) => {
    await assertPending(pendingId, "society_request");
    await repo.markPendingReviewed(pendingId, "approved", adminUserId, note);
    return { message: "Society request acknowledged. An ME will be assigned to visit." };
};

exports.rejectRequestByAdmin = async (pendingId, adminUserId, note) => {
    await assertPending(pendingId, "society_request");
    await repo.markPendingReviewed(pendingId, "rejected", adminUserId, note);
    return { message: "Society request rejected." };
};

// ── Admin: society_enrollment ──────────────────────────────────────────────
exports.listPendingEnrollments = async () => mapPending(await repo.getPendingEnrollments());

exports.approveEnrollmentByAdmin = async (pendingId, adminUserId, note) => {
    const pending = await assertPending(pendingId, "society_enrollment");
    const data = pending.form_data;

    await prisma.$transaction(async (tx) => {
        const professional = await repo.findProfessionalByReferralCode(tx, data.referralCode);
        if (!professional) throw new Error("Referral code is no longer valid.");
        const userId = await repo.insertUser(tx, data);
        await repo.insertSociety(tx, data, userId, professional.id);
        await repo.markPendingReviewed(pendingId, "approved", adminUserId, note);
    });

    return { message: "Society enrollment approved successfully." };
};

exports.rejectEnrollmentByAdmin = async (pendingId, adminUserId, note) => {
    await assertPending(pendingId, "society_enrollment");
    await repo.markPendingReviewed(pendingId, "rejected", adminUserId, note);
    return { message: "Society enrollment rejected." };
};

// ── ME: society_enrollment ─────────────────────────────────────────────────
const getMeProfessional = async (meUserId) => {
    const professional = await repo.findProfessionalByUserId(meUserId);
    if (!professional) {
        const err = new Error("Marketing Executive profile not found.");
        err.statusCode = 403;
        throw err;
    }
    return professional;
};

exports.listPendingEnrollmentsForMe = async (meUserId) => {
    const professional = await getMeProfessional(meUserId);
    return mapPending(await repo.getPendingEnrollmentsForMe(professional.referral_code));
};

exports.approveEnrollmentByMe = async (pendingId, meUserId, note) => {
    const pending = await assertPending(pendingId, "society_enrollment");
    const professional = await getMeProfessional(meUserId);

    if (pending.form_data.referralCode !== professional.referral_code) {
        const err = new Error("You are not authorized to approve this society enrollment.");
        err.statusCode = 403;
        throw err;
    }

    await prisma.$transaction(async (tx) => {
        const userId = await repo.insertUser(tx, pending.form_data);
        await repo.insertSociety(tx, pending.form_data, userId, professional.id);
        await repo.markPendingReviewed(pendingId, "approved", meUserId, note);
    });

    return { message: "Society enrollment approved successfully." };
};

exports.rejectEnrollmentByMe = async (pendingId, meUserId, note) => {
    const pending = await assertPending(pendingId, "society_enrollment");
    const professional = await getMeProfessional(meUserId);

    if (pending.form_data.referralCode !== professional.referral_code) {
        const err = new Error("You are not authorized to reject this society enrollment.");
        err.statusCode = 403;
        throw err;
    }

    await repo.markPendingReviewed(pendingId, "rejected", meUserId, note);
    return { message: "Society enrollment rejected." };
};
