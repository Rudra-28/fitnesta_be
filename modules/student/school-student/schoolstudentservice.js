const repo = require("./schoolstudentrepo");
const crypto = require('crypto');
const db = require("../../../config/db");

exports.initiateRegistration = async (formData, serviceType) => {
    const tempUuid = crypto.randomUUID();
    const conn = await db.getConnection();
    
    try {
        await repo.insertPendingRegistration(conn, tempUuid, formData, serviceType);
        return tempUuid;
    } finally {
        conn.release();
    }
};

exports.finalizeRegistration = async (tempUuid, paymentId = null) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const pending = await repo.getPendingByUuid(conn, tempUuid);
        if (!pending) throw new Error("Registration record not found or already processed");

        const data = typeof pending.form_data === 'string' 
            ? JSON.parse(pending.form_data) 
            : pending.form_data;
        
        // 1. Insert User & Student
        const userId = await repo.insertUser(conn, data);
        const studentId = await repo.insertStudent(conn, userId, pending.service_type);

        // 2. Insert School Specific Student Data
        await repo.insertSchoolStudent(conn, studentId, data);

        // 3. Mark as completed
        await repo.updatePendingStatus(conn, pending.id, 'completed');

        await conn.commit();
        return { userId, success: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.getRegistrationStatus = async (tempUuid) => {
    const conn = await db.getConnection();
    try {
        const pending = await repo.getPendingByUuid(conn, tempUuid);
        if (!pending) return { status: 'not_found' };
        
        return {
            status: pending.status,
            userId: pending.status === 'completed' ? 'User Created' : null 
        };
    } finally {
        conn.release();
    }
};