const db   = require("../../../config/db");
const crypto = require("crypto");

// ── STEP 1: Stage submission in pending_registrations ─────────────────────
exports.insertPending = async (formData, serviceType) => {
    const tempUuid = crypto.randomUUID();
    await db.execute(
        `INSERT INTO pending_registrations (temp_uuid, form_data, service_type, status)
         VALUES (?, ?, ?, 'pending')`,
        [tempUuid, JSON.stringify(formData), serviceType]
    );
    return tempUuid;
};

// Check if a society_unique_id already exists in the approved societies table
// or is staged as a specific pending service_type
exports.findBySocietyUniqueId = async (societyUniqueId) => {
    const [approved] = await db.execute(
        `SELECT id FROM societies WHERE society_unique_id = ? LIMIT 1`,
        [societyUniqueId]
    );
    if (approved.length) return { exists: true, where: 'approved', serviceType: null };

    const [pending] = await db.execute(
        `SELECT id, service_type FROM pending_registrations
         WHERE status = 'pending'
           AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.societyUniqueId')) = ?
         LIMIT 1`,
        [societyUniqueId]
    );
    if (pending.length) return { exists: true, where: 'pending', serviceType: pending[0].service_type };

    return { exists: false };
};

// When enrollment is submitted, auto-cancel any pending request from the
// same society so it never shows up as a dangling pending record
exports.cancelPendingRequest = async (societyUniqueId) => {
    await db.execute(
        `UPDATE pending_registrations
         SET status = 'rejected',
             review_note = 'Superseded by enrollment form submission'
         WHERE service_type = 'society_request'
           AND status = 'pending'
           AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.societyUniqueId')) = ?`,
        [societyUniqueId]
    );
};

// Validate referral code before staging
exports.findProfessionalByReferralCode = async (conn, referralCode) => {
    const [rows] = await conn.execute(
        `SELECT id FROM professionals WHERE referral_code = ? LIMIT 1`,
        [referralCode]
    );
    return rows.length ? rows[0] : null;
};

// ── STEP 2: Called by admin on approval ───────────────────────────────────
exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (full_name, mobile, role) VALUES (?, ?, 'student')`,
        [data.authorityPersonName, data.authorityContact]
    );
    return result.insertId;
};

exports.insertSociety = async (conn, data, userId, meProfessionalId = null) => {
    const [result] = await conn.execute(
        `INSERT INTO societies
         (society_unique_id, registered_by_user_id, me_professional_id, society_name, society_category,
          address, pin_code, total_participants, no_of_flats, proposed_wing, authority_role,
          authority_person_name, contact_number, playground_available,
          agreement_signed_by_authority, activity_agreement_pdf)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.societyUniqueId,
            userId,
            meProfessionalId,
            data.societyName,
            data.societyCategory,
            data.address,
            data.pinCode,
            Number(data.totalParticipants),
            Number(data.noOfFlats),
            data.proposedWing,
            data.authorityRole,
            data.authorityPersonName,
            data.contactNumber,
            data.playgroundAvailable ? 1 : 0,
            data.hasSignedAgreement ? 1 : 0,
            data.activityAgreementPdf ?? null,
        ]
    );
    return result.insertId;
};

// Get a professional record by user_id (used to resolve ME's referral_code and id)
exports.findProfessionalByUserId = async (userId) => {
    const [rows] = await db.execute(
        `SELECT id, referral_code FROM professionals WHERE user_id = ? LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
};

// Get a single pending_registrations row by id
exports.getPendingById = async (id) => {
    const [rows] = await db.execute(
        `SELECT * FROM pending_registrations WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0] || null;
};

// Admin: all pending society_request entries
exports.getPendingRequests = async () => {
    const [rows] = await db.execute(
        `SELECT id, temp_uuid, service_type, form_data, created_at
         FROM pending_registrations
         WHERE status = 'pending' AND service_type = 'society_request'
         ORDER BY created_at DESC`
    );
    return rows;
};

// Admin: all pending society_enrollment entries
exports.getPendingEnrollments = async () => {
    const [rows] = await db.execute(
        `SELECT id, temp_uuid, service_type, form_data, created_at
         FROM pending_registrations
         WHERE status = 'pending' AND service_type = 'society_enrollment'
         ORDER BY created_at DESC`
    );
    return rows;
};

// ME: pending society_enrollment entries that carry their referral code
exports.getPendingEnrollmentsForMe = async (meReferralCode) => {
    const [rows] = await db.execute(
        `SELECT id, temp_uuid, service_type, form_data, created_at
         FROM pending_registrations
         WHERE status = 'pending'
           AND service_type = 'society_enrollment'
           AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.referralCode')) = ?
         ORDER BY created_at DESC`,
        [meReferralCode]
    );
    return rows;
};

exports.markPendingReviewed = async (id, status, reviewedBy, note) => {
    await db.execute(
        `UPDATE pending_registrations
         SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [status, reviewedBy, note ?? null, id]
    );
};

exports.getAllSocieties = async () => {
    const [rows] = await db.query(
        `SELECT id, society_name, address, pin_code, society_category,
                agreement_signed_by_authority, approval_status
         FROM societies
         ORDER BY society_name ASC`
    );
    return rows;
};
