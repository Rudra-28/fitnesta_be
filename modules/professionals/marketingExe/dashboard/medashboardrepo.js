const db = require("../../../../config/db");

// ── Shared ──────────────────────────────────────────────────────────────────

exports.findProfessionalByUserId = async (userId) => {
    const [rows] = await db.execute(
        `SELECT id, referral_code FROM professionals WHERE user_id = ? LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
};

// ── Society ──────────────────────────────────────────────────────────────────

exports.societyUniqueIdExists = async (societyUniqueId) => {
    const [rows] = await db.execute(
        `SELECT id FROM societies WHERE society_unique_id = ? LIMIT 1`,
        [societyUniqueId]
    );
    return rows.length > 0;
};

exports.insertSociety = async (data, meUserId, meProfessionalId) => {
    const [result] = await db.execute(
        `INSERT INTO societies
         (society_unique_id, registered_by_user_id, me_professional_id, society_name, society_category,
          address, pin_code, total_participants, no_of_flats, proposed_wing, authority_role,
          authority_person_name, contact_number, playground_available,
          coordinator_name, coordinator_number,
          agreement_signed_by_authority, activity_agreement_pdf, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
        [
            data.societyUniqueId,
            meUserId,
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
            data.coordinatorName || null,
            data.coordinatorNumber || null,
            data.agreementSignedByAuthority ? 1 : 0,
            data.activityAgreementPdf || null,
        ]
    );
    return result.insertId;
};

exports.getSocietiesByMe = async (meProfessionalId) => {
    const [rows] = await db.execute(
        `SELECT id, society_unique_id, society_name, society_category, address, pin_code,
                total_participants, no_of_flats, proposed_wing, authority_role,
                authority_person_name, contact_number, playground_available,
                coordinator_name, coordinator_number,
                agreement_signed_by_authority, activity_agreement_pdf, approval_status, created_at
         FROM societies
         WHERE me_professional_id = ?
         ORDER BY created_at DESC`,
        [meProfessionalId]
    );
    return rows;
};

exports.getSocietyById = async (societyId, meProfessionalId) => {
    const [rows] = await db.execute(
        `SELECT * FROM societies WHERE id = ? AND me_professional_id = ? LIMIT 1`,
        [societyId, meProfessionalId]
    );
    return rows[0] || null;
};

// ── Dashboard Summary ────────────────────────────────────────────────────────

exports.getSummary = async (meProfessionalId) => {
    const [[{ societiesCount }]] = await db.execute(
        `SELECT COUNT(*) AS societiesCount FROM societies WHERE me_professional_id = ?`,
        [meProfessionalId]
    );
    const [[{ schoolsCount }]] = await db.execute(
        `SELECT COUNT(*) AS schoolsCount FROM schools WHERE me_professional_id = ?`,
        [meProfessionalId]
    );
    return { societiesCount, schoolsCount };
};

// ── School ───────────────────────────────────────────────────────────────────

exports.schoolNameExists = async (schoolName) => {
    const [rows] = await db.execute(
        `SELECT id FROM schools WHERE LOWER(school_name) = LOWER(?) LIMIT 1`,
        [schoolName]
    );
    return rows.length > 0;
};

// Creates a user record for the principal (authority person)
exports.insertPrincipalUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (role, full_name, mobile) VALUES ('student', ?, ?)`,
        [data.principalName, data.principalContact]
    );
    return result.insertId;
};

exports.insertSchool = async (conn, data, userId, meProfessionalId) => {
    const [result] = await conn.execute(
        `INSERT INTO schools
         (user_id, me_professional_id, school_name, address, pin_code, state,
          language_medium, landline_no, principal_name, principal_contact,
          activity_coordinator, agreement_signed_by_authority, activity_agreement_pdf, approval_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
        [
            userId,
            meProfessionalId,
            data.schoolName,
            data.address,
            data.pinCode,
            data.state,
            data.languageMedium  || null,
            data.landlineNo      || null,
            data.principalName,
            data.principalContact,
            data.activityCoordinator       || null,
            data.agreementSignedByAuthority ? 1 : 0,
            data.activityAgreementPdf      || null,
        ]
    );
    return result.insertId;
};

exports.getSchoolsByMe = async (meProfessionalId) => {
    const [rows] = await db.execute(
        `SELECT id, school_name, address, pin_code, state, language_medium,
                landline_no, principal_name, principal_contact, activity_coordinator,
                agreement_signed_by_authority, activity_agreement_pdf, approval_status, created_at
         FROM schools
         WHERE me_professional_id = ?
         ORDER BY created_at DESC`,
        [meProfessionalId]
    );
    return rows;
};

exports.getSchoolById = async (schoolId, meProfessionalId) => {
    const [rows] = await db.execute(
        `SELECT * FROM schools WHERE id = ? AND me_professional_id = ? LIMIT 1`,
        [schoolId, meProfessionalId]
    );
    return rows[0] || null;
};
