const db     = require("../../../config/db");
const crypto = require("crypto");

// ── STEP 1: Stage in pending_registrations ────────────────────────────────
exports.insertPending = async (formData, serviceType) => {
    const tempUuid = crypto.randomUUID();
    await db.execute(
        `INSERT INTO pending_registrations (temp_uuid, form_data, service_type, status)
         VALUES (?, ?, ?, 'pending')`,
        [tempUuid, JSON.stringify(formData), serviceType]
    );
    return tempUuid;
};

// Duplicate check by mobile — checks approved other_areas and pending_registrations
exports.findByMobile = async (mobile) => {
    const [approved] = await db.execute(
        `SELECT id FROM other_areas WHERE mobile = ? LIMIT 1`,
        [mobile]
    );
    if (approved.length) return { exists: true, where: 'approved' };

    const [pending] = await db.execute(
        `SELECT id, service_type FROM pending_registrations
         WHERE status = 'pending'
           AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.mobile')) = ?
         LIMIT 1`,
        [mobile]
    );
    if (pending.length) return { exists: true, where: 'pending', serviceType: pending[0].service_type };

    return { exists: false };
};

// Cancel pending other_area_request when enrollment is submitted for same mobile
exports.cancelPendingRequest = async (mobile) => {
    await db.execute(
        `UPDATE pending_registrations
         SET status = 'rejected',
             review_note = 'Superseded by enrollment form submission'
         WHERE service_type = 'other_area_request'
           AND status = 'pending'
           AND JSON_UNQUOTE(JSON_EXTRACT(form_data, '$.mobile')) = ?`,
        [mobile]
    );
};

// Validate referral code
exports.findProfessionalByReferralCode = async (conn, referralCode) => {
    const [rows] = await conn.execute(
        `SELECT id FROM professionals WHERE referral_code = ? LIMIT 1`,
        [referralCode]
    );
    return rows[0] || null;
};

// Get professional by user_id (for ME middleware)
exports.findProfessionalByUserId = async (userId) => {
    const [rows] = await db.execute(
        `SELECT id, referral_code FROM professionals WHERE user_id = ? LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
};

// Get a single pending row by id
exports.getPendingById = async (id) => {
    const [rows] = await db.execute(
        `SELECT * FROM pending_registrations WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0] || null;
};

// Admin: all pending other_area_request entries
exports.getPendingRequests = async () => {
    const [rows] = await db.execute(
        `SELECT id, temp_uuid, service_type, form_data, created_at
         FROM pending_registrations
         WHERE status = 'pending' AND service_type = 'other_area_request'
         ORDER BY created_at DESC`
    );
    return rows;
};

// Admin: all pending other_area_enrollment entries
exports.getPendingEnrollments = async () => {
    const [rows] = await db.execute(
        `SELECT id, temp_uuid, service_type, form_data, created_at
         FROM pending_registrations
         WHERE status = 'pending' AND service_type = 'other_area_enrollment'
         ORDER BY created_at DESC`
    );
    return rows;
};

// ME: pending other_area_enrollment entries that carry their referral code
exports.getPendingEnrollmentsForMe = async (meReferralCode) => {
    const [rows] = await db.execute(
        `SELECT id, temp_uuid, service_type, form_data, created_at
         FROM pending_registrations
         WHERE status = 'pending'
           AND service_type = 'other_area_enrollment'
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

// ── STEP 2: Called on approval ─────────────────────────────────────────────
exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (mobile, role) VALUES (?, 'student')`,
        [data.mobile]
    );
    return result.insertId;
};

exports.insertStudent = async (conn, userId) => {
    const [result] = await conn.execute(
        `INSERT INTO students (user_id, student_type) VALUES (?, 'group_coaching')`,
        [userId]
    );
    return result.insertId;
};

exports.insertOtherArea = async (conn, data, studentId, meProfessionalId = null) => {
    const [result] = await conn.execute(
        `INSERT INTO other_areas
         (student_id, sponsor_name, coordinator_name, address, mobile, marketing_incharge, me_professional_id, activity_agreement_pdf)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            studentId,
            data.sponsorName,
            data.coordinatorName,
            data.address,
            data.mobile,
            data.marketingIncharge,
            meProfessionalId,
            data.activityAgreementPdf ?? null,
        ]
    );
    return result.insertId;
};
