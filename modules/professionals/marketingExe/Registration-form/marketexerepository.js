const db = require("../../../../config/db");

// ── STEP 1: Save submission to staging table ──────────────────────────────
exports.insertPending = async (data) => {
    const tempUuid = require("crypto").randomUUID();
    await db.execute(
        `INSERT INTO pending_registrations (temp_uuid, form_data, service_type, status)
         VALUES (?, ?, 'marketing_executive', 'pending')`,
        [tempUuid, JSON.stringify(data)]
    );
    return tempUuid;
};

// ── STEP 2: Called by admin service on approval ───────────────────────────
exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (role, subrole, full_name, mobile, email, address, photo, approval_status)
         VALUES ('professional', 'marketing_executive', ?, ?, ?, ?, ?, 'approved')`,
        [
            data.fullName ?? null,
            data.contactNumber ?? null,
            data.email ?? null,
            data.address ?? null,
            data.photo ?? null,
        ]
    );
    return result.insertId;
};

exports.insertProfessional = async (conn, data, userId) => {
    const uuid = require("crypto").randomUUID();
    const referralCode = "FIT-" + uuid.replace(/-/g, "").substring(0, 8).toUpperCase();

    const [result] = await conn.execute(
        `INSERT INTO professionals
         (uuid, referral_code, user_id, profession_type, pan_card, adhar_card, relative_name, relative_contact,
          own_two_wheeler, communication_languages, place, date)
         VALUES (?, ?, ?, 'marketing_executive', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            uuid,
            referralCode,
            userId,
            data.panCard ?? null,
            data.adharCard ?? null,
            data.relativeName ?? null,
            data.relativeContact ?? null,
            data.ownTwoWheeler ? 1 : 0,
            JSON.stringify(data.communicationLanguages ?? []),
            data.place ?? null,
            data.date ?? null,
        ]
    );
    return result.insertId;
};

exports.insertMarketexe = async (conn, data, professionalId) => {
    const [result] = await conn.execute(
        `INSERT INTO marketing_executives
         (professional_id, dob, education_qualification, previous_experience, activity_agreement_pdf)
         VALUES (?, ?, ?, ?, ?)`,
        [
            professionalId,
            data.dob ?? null,
            data.educationQualification ?? null,
            data.previousExperience ?? null,
            data.activityAgreementsPdf ?? null,
        ]
    );
    return result.insertId;
};

exports.getAllMarketexe = async () => {
    const [rows] = await db.execute(
        `SELECT
            u.id AS user_id, u.full_name, u.mobile, u.email, u.address, u.photo,
            p.id AS professional_id, p.pan_card, p.adhar_card, p.relative_name,
            p.relative_contact, p.own_two_wheeler, p.communication_languages, p.place, p.date,
            m.id AS market_exe_id, m.dob, m.education_qualification,
            m.previous_experience, m.activity_agreement_pdf
         FROM marketing_executives m
         JOIN professionals p ON m.professional_id = p.id
         JOIN users u ON p.user_id = u.id`
    );
    return rows;
};
