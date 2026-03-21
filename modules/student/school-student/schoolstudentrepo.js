const db = require("../../../config/db");

// --- PERMANENT STORAGE FUNCTIONS ---

exports.insertUser = async (conn, data) => {
    const [result] = await conn.execute(
        `INSERT INTO users (role, full_name, mobile) VALUES (?, ?, ?)`,
        ['student', data.fullName, data.mobile]
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

exports.insertSchoolStudent = async (conn, studentId, data) => {
    return await conn.execute(
        `INSERT INTO school_students (student_id, school_id, student_name, standard, address, kit_type) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            studentId, 
            data.school_id, 
            data.fullName, 
            data.standard, 
            data.address, 
            data.kit_type
        ]
    );
};

// --- PENDING STATE FUNCTIONS ---

exports.insertPendingRegistration = async (conn, tempUuid, formData, serviceType) => {
    const jsonData = JSON.stringify(formData);
    return await conn.execute(
        `INSERT INTO pending_registrations (temp_uuid, form_data, service_type) VALUES (?, ?, ?)`,
        [tempUuid, jsonData, serviceType]
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
