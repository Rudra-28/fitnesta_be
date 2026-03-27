const db   = require("../../../../config/db");
const repo = require("./medashboardrepo");

const getMeProfessional = async (meUserId) => {
    const professional = await repo.findProfessionalByUserId(meUserId);
    if (!professional) {
        const err = new Error("Marketing Executive profile not found.");
        err.statusCode = 403;
        throw err;
    }
    return professional;
};

// ── Dashboard Summary ────────────────────────────────────────────────────────

exports.getSummary = async (meUserId) => {
    const professional = await getMeProfessional(meUserId);
    return await repo.getSummary(professional.id);
};

// ── Society ──────────────────────────────────────────────────────────────────

exports.registerSociety = async (data, meUserId) => {
    const professional = await getMeProfessional(meUserId);

    const exists = await repo.societyUniqueIdExists(data.societyUniqueId);
    if (exists) {
        const err = new Error("A society with this ID is already registered.");
        err.statusCode = 409;
        throw err;
    }

    const societyId = await repo.insertSociety(data, meUserId, professional.id);
    return { success: true, societyId, message: "Society registered successfully." };
};

exports.getMySocieties = async (meUserId) => {
    const professional = await getMeProfessional(meUserId);
    return await repo.getSocietiesByMe(professional.id);
};

exports.getSocietyById = async (societyId, meUserId) => {
    const professional = await getMeProfessional(meUserId);
    const society = await repo.getSocietyById(societyId, professional.id);
    if (!society) {
        const err = new Error("Society not found.");
        err.statusCode = 404;
        throw err;
    }
    return society;
};

// ── School ───────────────────────────────────────────────────────────────────

exports.registerSchool = async (data, meUserId) => {
    const professional = await getMeProfessional(meUserId);

    const exists = await repo.schoolNameExists(data.schoolName);
    if (exists) {
        const err = new Error("A school with this name is already registered.");
        err.statusCode = 409;
        throw err;
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const userId   = await repo.insertPrincipalUser(conn, data);
        const schoolId = await repo.insertSchool(conn, data, userId, professional.id);
        await conn.commit();
        return { success: true, schoolId, userId, message: "School registered successfully." };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

exports.getMySchools = async (meUserId) => {
    const professional = await getMeProfessional(meUserId);
    return await repo.getSchoolsByMe(professional.id);
};

exports.getSchoolById = async (schoolId, meUserId) => {
    const professional = await getMeProfessional(meUserId);
    const school = await repo.getSchoolById(schoolId, professional.id);
    if (!school) {
        const err = new Error("School not found.");
        err.statusCode = 404;
        throw err;
    }
    return school;
};
