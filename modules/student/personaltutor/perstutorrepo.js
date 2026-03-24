const db = require("../../../config/db");

exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (role, full_name, address, mobile) VALUES (?, ?, ?, ?)`,
        ['student', data?.fullName || null, data?.address || null, data?.contactNumber || null]
    );
    return result.insertId;
};

exports.insertStudent = async (conn, userId, type) => {
    const [result] = await conn.execute(
        `INSERT INTO students (user_id, student_type) VALUES (?, ?)`,
        [userId, type]
    );
    return result.insertId;
};

exports.insertpersonalTutor = async (conn, studentId, data) => {
    return await conn.execute(
        `INSERT INTO personal_tutors (student_id, dob, standard, batch, teacher_for) VALUES (?, ?, ?, ?, ?)`,
        [
            studentId, 
            data?.dob || null, 
            data?.standard || null, 
            data?.batch || null, 
            data?.teacherFor || null
        ]
    );
};

exports.insertParentConsent = async (conn, studentId, data) => {
    if (!data) return null; // Skip if no consent data provided (e.g. adult students)
    
    return await conn.execute(
        `INSERT INTO parent_consents (student_id, society_name, parent_name, emergency_contact_no, activity_enrolled, parent_signature_doc, consent_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            studentId, 
            data.society_name || null, 
            data.parentName || null, 
            data.emergencyContactNo || null, 
            data.activity_enrolled || null, 
            data.signatureUrl || null, 
            data.consent_date || null
        ]
    );
};

exports.insertPendingRegistration = async (conn, tempUuid, formData, serviceType) => {
    const jsonData = JSON.stringify(formData);
    return await conn.execute(
        `INSERT INTO pending_registrations (temp_uuid, form_data, service_type) VALUES (?, ?, ?)`,
        [tempUuid, jsonData, serviceType || 'personal_tutor']
    );
};

exports.getPendingByUuid = async (conn, tempUuid) => {
    const [rows] = await conn.execute(
        `SELECT * FROM pending_registrations WHERE temp_uuid = ? AND status = 'pending'`,
        [tempUuid]
    );
    return rows[0];
};

exports.updatePendingStatus = async (conn, id, status) => {
    return await conn.execute(
        `UPDATE pending_registrations SET status = ? WHERE id = ?`,
        [status, id]
    );
};

exports.getpersonaltutordetails = async (userId) => {
    const [rows] = await db.execute(
        `SELECT 
            u.full_name, u.address, u.mobile, 
            s.id AS student_id, s.type,
            pt.dob, pt.standard, pt.batch, pt.teacher_for
         FROM users u 
         JOIN students s ON u.id = s.user_id 
         LEFT JOIN personal_tutors pt ON s.id = pt.student_id
         WHERE u.id = ?`,
        [userId]
    );
    return rows[0];
};