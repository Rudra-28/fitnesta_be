const adminRepo = require("./adminrepository");
const trainerRepo = require("../professionals/trainer/trainerrepository");
const teacherRepo = require("../professionals/teacher/teacherepository");
const vendorRepo = require("../professionals/vendor/vendorrepository");
const meRepo = require("../professionals/marketingExe/Registration-form/marketexerepository");
const societyRepo = require("../student/society/societyrepo");
const db = require("../../config/db");

exports.listPending = async (serviceType) => {
    const rows = await adminRepo.getAllPending(serviceType);
    return rows.map(r => ({
        id: r.id,
        tempUuid: r.temp_uuid,
        serviceType: r.service_type,
        submittedAt: r.created_at,
        formData: r.form_data
    }));
};

exports.approveRegistration = async (pendingId, adminUserId, note) => {
    const pending = await adminRepo.getById(pendingId);

    if (!pending) throw new Error("PENDING_NOT_FOUND");
    if (pending.status !== 'pending') throw new Error("ALREADY_REVIEWED");

    const data = pending.form_data;

    // Strip surrounding double-quotes from date strings that some clients send quoted
    const stripQuotes = (val) => (typeof val === 'string' ? val.replace(/^"|"$/g, '').trim() : val);
    if (data.date) data.date = stripQuotes(data.date);
    if (data.dob) data.dob = stripQuotes(data.dob);

    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        switch (pending.service_type) {
            case 'trainer':
                await approveTrainer(conn, data);
                break;
            case 'teacher':
                await approveTeacher(conn, data);
                break;
            case 'vendor':
                await approveVendor(conn, data);
                break;
            case 'marketing_executive':
                await approveMarketingExecutive(conn, data);
                break;
            case 'society_request':
                await approveSocietyRequest(conn, data);
                break;
            case 'society_enrollment':
                await approveSocietyEnrollment(conn, data);
                break;
            default:
                throw new Error(`No approval handler for service_type: ${pending.service_type}`);
        }

        await adminRepo.markReviewed(pendingId, 'approved', adminUserId, note);
        await conn.commit();

        return { message: "Registration approved successfully." };

    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

exports.rejectRegistration = async (pendingId, adminUserId, note) => {
    const pending = await adminRepo.getById(pendingId);

    if (!pending) throw new Error("PENDING_NOT_FOUND");
    if (pending.status !== 'pending') throw new Error("ALREADY_REVIEWED");

    await adminRepo.markReviewed(pendingId, 'rejected', adminUserId, note);
    return { message: "Registration rejected." };
};

// ── Approval handlers per service type ────────────────────────────────────

async function approveTrainer(conn, data) {
    const userId = await trainerRepo.insertUser(conn, data);
    const professionalId = await trainerRepo.insertProfessional(conn, data, userId);
    await trainerRepo.insertTrainer(conn, data, professionalId);
}

async function approveTeacher(conn, data) {
    const userId = await teacherRepo.insertUser(conn, data);
    const professionalId = await teacherRepo.insertProfessional(conn, data, userId);
    await teacherRepo.insertTeacher(conn, data, professionalId);
}

async function approveVendor(conn, data) {
    const userId = await vendorRepo.insertUser(conn, data);
    const professionalId = await vendorRepo.insertProfessional(conn, data, userId);
    await vendorRepo.insertVendors(conn, data, professionalId);
}

async function approveMarketingExecutive(conn, data) {
    const userId = await meRepo.insertUser(conn, data);
    const professionalId = await meRepo.insertProfessional(conn, data, userId);
    await meRepo.insertMarketexe(conn, data, professionalId);
}

async function approveSocietyRequest(conn, data) {
    const userId = await societyRepo.insertUser(conn, data);
    await societyRepo.insertSociety(conn, data, userId, null);
}

async function approveSocietyEnrollment(conn, data) {
    const professional = await societyRepo.findProfessionalByReferralCode(conn, data.referralCode);
    if (!professional) throw new Error("Referral code is no longer valid.");
    const userId = await societyRepo.insertUser(conn, data);
    await societyRepo.insertSociety(conn, data, userId, professional.id);
}


