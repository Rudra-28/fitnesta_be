const repo = require("./indicoachrepo");
const crypto = require('crypto'); // Built-in Node.js module
const db = require("../../../config/db");

/**
 * PHASE 1: Save data to pending table and return a UUID
 */
exports.initiateRegistration = async (formData, serviceType) => {
    // Generate a unique ID for this transaction
    const tempUuid = crypto.randomUUID();
    const conn = await db.getConnection();
    
    try {
        // This "parks" the big JSON in your pending_registrations table
        await repo.insertPendingRegistration(conn, tempUuid, formData, serviceType);
        return tempUuid;
    } catch (error) {
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * PHASE 2: Move data from pending to permanent tables
 */
exports.finalizeRegistration = async (tempUuid) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const pending = await repo.getPendingByUuid(conn, tempUuid);
        if (!pending) throw new Error("Registration record not found or already processed");

        const data = typeof pending.form_data === 'string' 
        ? JSON.parse(pending.form_data) 
        : pending.form_data;
        
        // 1. Insert User & Student
        const userId = await repo.insertUser(conn, data.user_info);
        // Uses the accurate serviceType captured during initiateRegistration
        const studentId = await repo.insertStudent(conn, userId, pending.service_type);

        // 2. Insert Form Specifics (Tutor + Consent)
        await repo.insertindividualcoaching(conn, studentId, data.individualcoaching);
        await repo.insertParentConsent(conn, studentId, data.consentDetails);

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

/**
 * PHASE 3: Check status for Frontend
 */
exports.getRegistrationStatus = async (tempUuid) => {
    const conn = await db.getConnection();
    try {
        const pending = await repo.getPendingByUuid(conn, tempUuid);
        if (!pending) return { status: 'not_found' };
        
        return {
            status: pending.status,
            // You might want to return the actual user ID once completed
            userId: pending.status === 'completed' ? 'User Created' : null 
        };
    } finally {
        conn.release();
    }
};