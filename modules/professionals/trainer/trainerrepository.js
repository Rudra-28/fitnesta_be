const db = require("../../../config/db");

// ── STEP 1: Save submission to staging table ──────────────────────────────
exports.insertPending = async (data) => {
    const tempUuid = require("crypto").randomUUID();
    await db.execute(
        `INSERT INTO pending_registrations (temp_uuid, form_data, service_type, status)
         VALUES (?, ?, 'trainer', 'pending')`,
        [tempUuid, JSON.stringify(data)]
    );
    return tempUuid;
};

// ── STEP 2: Called by admin service on approval ───────────────────────────
exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (role, subrole, full_name, mobile, email, address, photo, approval_status)
         VALUES ('professional', 'trainer', ?, ?, ?, ?, ?, 'approved')`,
        [
            data.fullName,
            data.contactNumber,
            data.email      ?? null,
            data.address    ?? null,
            data.photo      ?? null,
        ]
    );
    return result.insertId;
};

exports.insertProfessional = async (conn, data, userId) => {
    const uuid         = require("crypto").randomUUID();
    const referralCode = "FIT-" + uuid.replace(/-/g, "").substring(0, 8).toUpperCase();

    const [result] = await conn.execute(
        `INSERT INTO professionals
         (uuid, referral_code, user_id, profession_type, pan_card, adhar_card, relative_name, relative_contact,
          own_two_wheeler, communication_languages, place, date)
         VALUES (?, ?, ?, 'trainer', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            uuid,
            referralCode,
            userId,
            data.panCard                ?? null,
            data.adharCard              ?? null,
            data.relativeName           ?? null,
            data.relativeContact        ?? null,
            data.ownTwoWheeler ? 1 : 0,
            JSON.stringify(data.communicationLanguages ?? []),
            data.place                  ?? null,
            data.date                   ?? null,
        ]
    );
    return result.insertId;
};

exports.insertTrainer = async (conn, data, professionalId) => {
    const [result] = await conn.execute(
        `INSERT INTO trainers
         (professional_id, player_level, category, specified_game, specified_skills,
          experience_details, qualification_docs, documents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            professionalId,
            data.playerLevel ?? null,
            data.category    ?? null,
            JSON.stringify(data.specifiedGame   ?? []),
            JSON.stringify(data.specifiedSkills ?? []),
            data.experienceDetails      ?? null,
            data.qualificationDocs      ?? null,
            data.documents              ?? null,
        ]
    );
    return result.insertId;
};
