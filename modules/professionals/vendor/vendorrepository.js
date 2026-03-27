const db = require("../../../config/db");

// ── STEP 1: Save submission to staging table ──────────────────────────────
exports.insertPending = async (data) => {
    const tempUuid = require("crypto").randomUUID();
    await db.execute(
        `INSERT INTO pending_registrations (temp_uuid, form_data, service_type, status)
         VALUES (?, ?, 'vendor', 'pending')`,
        [tempUuid, JSON.stringify(data)]
    );
    return tempUuid;
};

// ── STEP 2: Called by admin service on approval ───────────────────────────
exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (role, subrole, full_name, mobile, email, address, approval_status)
         VALUES ('professional', 'vendor', ?, ?, ?, ?, 'approved')`,
        [
            data.fullName,
            data.contactNumber,
            data.email      ?? null,
            data.address    ?? null,
        ]
    );
    return result.insertId;
};

exports.insertProfessional = async (conn, data, userId) => {
    const uuid         = require("crypto").randomUUID();
    const referralCode = "FIT-" + uuid.replace(/-/g, "").substring(0, 8).toUpperCase();

    const [result] = await conn.execute(
        `INSERT INTO professionals (uuid, referral_code, user_id, profession_type, pan_card, adhar_card)
         VALUES (?, ?, ?, 'vendor', ?, ?)`,
        [
            uuid,
            referralCode,
            userId,
            data.panCard    ?? null,
            data.adharCard  ?? null,
        ]
    );
    return result.insertId;
};

exports.insertVendors = async (conn, data, professionalId) => {
    await conn.execute(
        `INSERT INTO vendors (professional_id, store_name, store_address, store_location, gst_certificate)
         VALUES (?, ?, ?, ?, ?)`,
        [
            professionalId,
            data.storeName      ?? null,
            data.storeAddress   ?? null,
            data.storeLocation  ?? null,
            data.GSTCertificate ?? null,
        ]
    );
};

exports.getAllVendors = async () => {
    const [rows] = await db.execute(
        `SELECT
            u.id AS user_id, u.full_name, u.mobile, u.email, u.address,
            p.id AS professional_id, p.uuid, p.referral_code, p.pan_card, p.adhar_card,
            v.id AS vendor_id, v.store_name, v.store_address, v.store_location, v.gst_certificate
         FROM vendors v
         JOIN professionals p ON v.professional_id = p.id
         JOIN users u ON p.user_id = u.id`
    );
    return rows;
};
