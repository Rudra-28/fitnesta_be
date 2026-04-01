const repo = require("./societyrepo");

exports.registerSociety = async (data) => {
    const duplicate = await repo.findBySocietyUniqueId(data.societyUniqueId);

    if (duplicate.exists) {
        if (duplicate.where === "approved") {
            const err = new Error("A society with this ID is already registered.");
            err.statusCode = 409;
            throw err;
        }
        const err = new Error("A registration request for this Society ID is already pending approval.");
        err.statusCode = 409;
        throw err;
    }

    const tempUuid = await repo.insertPending(data, "society_request");

    return {
        success: true,
        tempUuid,
        message: "Society registration request submitted. Awaiting admin review.",
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
        assignedMeId: r.assigned_me_id ?? null,
        assignedMeAt: r.assigned_me_at ?? null,
        formData: r.form_data,
    }));

const assertPending = async (pendingId) => {
    const pending = await repo.getPendingById(pendingId);
    if (!pending) { const err = new Error("PENDING_NOT_FOUND"); err.statusCode = 404; throw err; }
    if (pending.status !== "pending") { const err = new Error("ALREADY_REVIEWED"); err.statusCode = 409; throw err; }
    if (pending.service_type !== "society_request") {
        const err = new Error(`Expected a society_request entry, got ${pending.service_type}.`);
        err.statusCode = 400;
        throw err;
    }
    return pending;
};

// ── Admin: society_request ─────────────────────────────────────────────────
exports.listPendingRequests = async () => mapPending(await repo.getPendingRequests());

exports.assignMeToRequest = async (pendingId, meProfessionalId) => {
    await assertPending(pendingId);

    const me = await repo.findProfessionalById(meProfessionalId);
    if (!me) {
        const err = new Error("Marketing Executive not found.");
        err.statusCode = 404;
        throw err;
    }

    await repo.assignMe(pendingId, meProfessionalId);
    return { message: "ME assigned to society request successfully." };
};

exports.approveRequestByAdmin = async (pendingId, adminUserId, note) => {
    await assertPending(pendingId);
    await repo.markPendingReviewed(pendingId, "approved", adminUserId, note);
    return { message: "Society request approved." };
};

exports.rejectRequestByAdmin = async (pendingId, adminUserId, note) => {
    await assertPending(pendingId);
    await repo.markPendingReviewed(pendingId, "rejected", adminUserId, note);
    return { message: "Society request rejected." };
};
