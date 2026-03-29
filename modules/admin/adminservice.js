const prisma = require("../../config/prisma");
const adminRepo = require("./adminrepository");
const trainerRepo = require("../professionals/trainer/trainerrepository");
const teacherRepo = require("../professionals/teacher/teacherepository");
const vendorRepo = require("../professionals/vendor/vendorregistration/vendorrepository");
const meRepo = require("../professionals/marketingExe/Registration-form/marketexerepository");
const societyRepo = require("../student/society/societyrepo");

exports.listPending = async (serviceType) => {
    const rows = await adminRepo.getAllPending(serviceType);
    return rows.map((r) => ({
        id: r.id,
        tempUuid: r.temp_uuid,
        serviceType: r.service_type,
        submittedAt: r.created_at,
        formData: r.form_data,
    }));
};

exports.approveRegistration = async (pendingId, adminUserId, note) => {
    const pending = await adminRepo.getById(pendingId);

    if (!pending) throw new Error("PENDING_NOT_FOUND");
    if (pending.status !== "pending") throw new Error("ALREADY_REVIEWED");

    const data = pending.form_data;

    // Strip surrounding double-quotes from date strings some clients send quoted
    const stripQuotes = (val) =>
        typeof val === "string" ? val.replace(/^"|"$/g, "").trim() : val;
    if (data.date) data.date = stripQuotes(data.date);
    if (data.dob) data.dob = stripQuotes(data.dob);

    await prisma.$transaction(async (tx) => {
        switch (pending.service_type) {
            case "trainer":
                await approveTrainer(tx, data);
                break;
            case "teacher":
                await approveTeacher(tx, data);
                break;
            case "vendor":
                await approveVendor(tx, data);
                break;
            case "marketing_executive":
                await approveMarketingExecutive(tx, data);
                break;
            case "society_request":
                await approveSocietyRequest(tx, data);
                break;
            case "society_enrollment":
                await approveSocietyEnrollment(tx, data);
                break;
            default:
                throw new Error(`No approval handler for service_type: ${pending.service_type}`);
        }

        await adminRepo.markReviewed(tx, pendingId, "approved", adminUserId, note);
    });

    return { message: "Registration approved successfully." };
};

exports.rejectRegistration = async (pendingId, adminUserId, note) => {
    const pending = await adminRepo.getById(pendingId);

    if (!pending) throw new Error("PENDING_NOT_FOUND");
    if (pending.status !== "pending") throw new Error("ALREADY_REVIEWED");

    await adminRepo.markReviewed(null, pendingId, "rejected", adminUserId, note);
    return { message: "Registration rejected." };
};

// ── Approval handlers ──────────────────────────────────────────────────────

async function approveTrainer(tx, data) {
    const userId = await trainerRepo.insertUser(tx, data);
    const professionalId = await trainerRepo.insertProfessional(tx, data, userId);
    await trainerRepo.insertTrainer(tx, data, professionalId);
}

async function approveTeacher(tx, data) {
    const userId = await teacherRepo.insertUser(tx, data);
    const professionalId = await teacherRepo.insertProfessional(tx, data, userId);
    await teacherRepo.insertTeacher(tx, data, professionalId);
}

async function approveVendor(tx, data) {
    const userId = await vendorRepo.insertUser(tx, data);
    const professionalId = await vendorRepo.insertProfessional(tx, data, userId);
    await vendorRepo.insertVendors(tx, data, professionalId);
}

async function approveMarketingExecutive(tx, data) {
    const userId = await meRepo.insertUser(tx, data);
    const professionalId = await meRepo.insertProfessional(tx, data, userId);
    await meRepo.insertMarketexe(tx, data, professionalId);
}

async function approveSocietyRequest(tx, data) {
    const userId = await societyRepo.insertUser(tx, data);
    await societyRepo.insertSociety(tx, data, userId, null);
}

async function approveSocietyEnrollment(tx, data) {
    const professional = await societyRepo.findProfessionalByReferralCode(tx, data.referralCode);
    if (!professional) throw new Error("Referral code is no longer valid.");
    const userId = await societyRepo.insertUser(tx, data);
    await societyRepo.insertSociety(tx, data, userId, professional.id);
}
