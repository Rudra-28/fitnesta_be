const prisma = require("../../config/prisma");
const adminRepo = require("./adminrepository");
const activitiesRepo = require("../activities/activitiesrepository");
const trainerRepo = require("../professionals/trainer/trainerrepository");
const teacherRepo = require("../professionals/teacher/teacherepository");
const vendorRepo = require("../professionals/vendor/vendorregistration/vendorrepository");
const meRepo = require("../professionals/marketingExe/Registration-form/marketexerepository");
const societyRepo = require("../student/society/societyrepo");
const commissionService = require("../commissions/commissionservice");

const SOCIETY_CATEGORY_DISPLAY = { A_: "A+", A: "A", B: "B" };

const VALID_SECTIONS = ["school", "society", "individual_coaching", "personal_tutor"];

const SECTION_TO_COACHING_TYPE = {
    school:               "school_student",
    society:              "group_coaching",
    individual_coaching:  "individual_coaching",
    personal_tutor:       "personal_tutor",
};

exports.listFeeStructures = async (section) => {
    if (section && !VALID_SECTIONS.includes(section)) throw new Error("INVALID_SECTION");

    const coachingType = section ? SECTION_TO_COACHING_TYPE[section] : null;
    const rows = await adminRepo.getFeeStructures(coachingType);

    const formatFee = (f) => ({
        coaching_type:     f.coaching_type,
        society_category:  f.society_category ? (SOCIETY_CATEGORY_DISPLAY[f.society_category] ?? f.society_category) : null,
        standard:          f.standard ?? null,
        term_months:       f.term_months,
        total_fee:         parseFloat(f.total_fee),
        effective_monthly: f.effective_monthly !== null ? parseFloat(f.effective_monthly) : null,
    });

    if (section === "school") {
        // School: flat list per activity, no society_category or standard
        return rows.map((a) => ({
            activity_id:   a.id,
            activity_name: a.name,
            fees:          a.fee_structures.map(formatFee),
        }));
    }

    if (section === "society") {
        // Society (group_coaching): group by activity → then by society_category (A+/A/B)
        return rows.map((a) => {
            const byCategory = {};
            for (const f of a.fee_structures) {
                const cat = SOCIETY_CATEGORY_DISPLAY[f.society_category] ?? f.society_category ?? "ALL";
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push({
                    term_months:       f.term_months,
                    total_fee:         parseFloat(f.total_fee),
                    effective_monthly: f.effective_monthly !== null ? parseFloat(f.effective_monthly) : null,
                });
            }
            return { activity_id: a.id, activity_name: a.name, by_category: byCategory };
        });
    }

    if (section === "individual_coaching") {
        // Individual coaching: flat list per activity, no grouping needed
        return rows.map((a) => ({
            activity_id:   a.id,
            activity_name: a.name,
            fees:          a.fee_structures.map(formatFee),
        }));
    }

    if (section === "personal_tutor") {
        // Personal tutor: group by activity → then by standard (1ST-2ND, 3RD-4TH, etc.)
        return rows.map((a) => {
            const byStandard = {};
            for (const f of a.fee_structures) {
                const std = f.standard ?? "ANY";
                if (!byStandard[std]) byStandard[std] = [];
                byStandard[std].push({
                    term_months:       f.term_months,
                    total_fee:         parseFloat(f.total_fee),
                    effective_monthly: f.effective_monthly !== null ? parseFloat(f.effective_monthly) : null,
                });
            }
            return { activity_id: a.id, activity_name: a.name, by_standard: byStandard };
        });
    }

    // No section filter — return everything grouped by coaching_type
    const grouped = { school: [], society: [], individual_coaching: [], personal_tutor: [] };
    const sectionForType = {
        school_student:      "school",
        group_coaching:      "society",
        individual_coaching: "individual_coaching",
        personal_tutor:      "personal_tutor",
    };
    for (const a of rows) {
        for (const f of a.fee_structures) {
            const key = sectionForType[f.coaching_type];
            if (!key) continue;
            let entry = grouped[key].find((x) => x.activity_id === a.id);
            if (!entry) {
                entry = { activity_id: a.id, activity_name: a.name, fees: [] };
                grouped[key].push(entry);
            }
            entry.fees.push(formatFee(f));
        }
    }
    return grouped;
};

exports.listStudents = async (type) => {
    if (type === "personal_tutor") {
        const rows = await adminRepo.getAllPersonalTutors();
        return rows.map((r) => ({
            personal_tutor_id: r.id,
            student_id: r.students?.id ?? null,
            student_name: r.students?.users?.full_name ?? null,
            student_mobile: r.students?.users?.mobile ?? null,
            standard: r.standard,
            batch: r.batch,
            teacher_for: r.teacher_for,
            dob: r.dob,
            assigned: r.teacher_professional_id !== null,
            assigned_teacher: r.teacher_professional_id
                ? {
                    professional_id: r.professionals?.id,
                    name: r.professionals?.users?.full_name ?? null,
                    mobile: r.professionals?.users?.mobile ?? null,
                    subject: r.professionals?.teachers?.[0]?.subject ?? null,
                }
                : null,
        }));
    }

    if (type === "individual_coaching") {
        const rows = await adminRepo.getAllIndividualParticipants();
        return rows.map((r) => ({
            individual_participant_id: r.id,
            student_id: r.students?.id ?? null,
            student_name: r.students?.users?.full_name ?? null,
            student_mobile: r.students?.users?.mobile ?? null,
            activity: r.activity,
            flat_no: r.flat_no,
            society: r.society_name ?? null,
            dob: r.dob,
            age: r.age,
            kits: r.kits,
            assigned: r.trainer_professional_id !== null,
            assigned_trainer: r.trainer_professional_id
                ? {
                    professional_id: r.professionals?.id,
                    name: r.professionals?.users?.full_name ?? null,
                    mobile: r.professionals?.users?.mobile ?? null,
                    category: r.professionals?.trainers?.[0]?.category ?? null,
                    specified_game: r.professionals?.trainers?.[0]?.specified_game ?? null,
                }
                : null,
        }));
    }

    throw new Error("INVALID_TYPE");
};

exports.listProfessionals = async (type) => {
    const rows = await adminRepo.getApprovedProfessionals(type);
    return rows.map((r) => ({
        professional_id: r.id,
        profession_type: r.profession_type,
        referral_code: r.referral_code,
        place: r.place,
        date: r.date,
        own_two_wheeler: r.own_two_wheeler,
        communication_languages: r.communication_languages,
        pan_card: r.pan_card,
        adhar_card: r.adhar_card,
        relative_name: r.relative_name,
        relative_contact: r.relative_contact,
        wallet_balance: r.wallets?.balance ?? 0,
        user: r.users,
        details: r.trainers?.[0] ?? r.teachers?.[0] ?? r.marketing_executives?.[0] ?? r.vendors?.[0] ?? null,
    }));
};

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

    // Capture society/school data returned from handlers so we can
    // trigger ME onboarding commission after the transaction commits.
    let onboardingEntity = null;
    let onboardingType   = null;

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
                onboardingEntity = await approveSocietyRequest(tx, data);
                onboardingType   = "society";
                break;
            case "society_enrollment":
                onboardingEntity = await approveSocietyEnrollment(tx, data);
                onboardingType   = "society";
                break;
            default:
                throw new Error(`No approval handler for service_type: ${pending.service_type}`);
        }

        await adminRepo.markReviewed(tx, pendingId, "approved", adminUserId, note);
    });

    // Calculate ME onboarding commission after transaction commits (fire-and-forget)
    if (onboardingEntity && onboardingType) {
        await commissionService.calculateMEOnboardingCommission(onboardingType, onboardingEntity);
    }

    return { message: "Registration approved successfully." };
};

// ── Student assignment ─────────────────────────────────────────────────────

exports.getUnassignedStudents = async (service) => {
    if (service === "personal_tutor") {
        const rows = await adminRepo.getUnassignedPersonalTutors();
        return rows.map((r) => ({
            personal_tutor_id: r.id,
            student_id: r.students?.id ?? null,
            full_name: r.students?.users?.full_name ?? null,
            mobile: r.students?.users?.mobile ?? null,
            standard: r.standard,
            batch: r.batch,
            teacher_for: r.teacher_for,
            dob: r.dob,
        }));
    }

    if (service === "individual_coaching") {
        const rows = await adminRepo.getUnassignedIndividualParticipants();
        return rows.map((r) => ({
            individual_participant_id: r.id,
            student_id: r.students?.id ?? null,
            full_name: r.students?.users?.full_name ?? null,
            mobile: r.students?.users?.mobile ?? null,
            activity: r.activity,
            flat_no: r.flat_no,
            society: r.society_name || r.manually_entered_society || null,
            dob: r.dob,
        }));
    }

    throw new Error("INVALID_SERVICE");
};

exports.getAvailableProfessionals = async (type, { date, startTime, endTime } = {}) => {
    // Parse time strings to Date objects if provided (needed for Prisma Time comparisons)
    const parseTime = (t) => {
        if (!t) return undefined;
        const [h, m, s = "0"] = String(t).split(":");
        return new Date(1970, 0, 1, Number(h), Number(m), Number(s));
    };
    const timeFilter = date && startTime && endTime
        ? { date, startTime: parseTime(startTime), endTime: parseTime(endTime) }
        : {};

    if (type === "teacher") {
        const rows = await adminRepo.getAvailableTeachers(timeFilter);
        return rows.map((r) => ({
            professional_id: r.id,
            full_name: r.users?.full_name ?? null,
            mobile: r.users?.mobile ?? null,
            subject: r.teachers?.[0]?.subject ?? null,
            experience: r.teachers?.[0]?.experience_details ?? null,
        }));
    }

    if (type === "trainer") {
        const rows = await adminRepo.getAvailableTrainers(timeFilter);
        return rows.map((r) => ({
            professional_id: r.id,
            full_name: r.users?.full_name ?? null,
            mobile: r.users?.mobile ?? null,
            category: r.trainers?.[0]?.category ?? null,
            specified_game: r.trainers?.[0]?.specified_game ?? null,
            experience: r.trainers?.[0]?.experience_details ?? null,
        }));
    }

    throw new Error("INVALID_TYPE");
};

exports.getApprovedSocieties = async () => {
    return await adminRepo.getApprovedSocieties();
};

exports.getApprovedSchools = async () => {
    return await adminRepo.getApprovedSchools();
};

exports.assignTeacher = async (personalTutorId, teacherProfessionalId) => {
    const pt = await adminRepo.findPersonalTutorById(personalTutorId);
    if (!pt) throw new Error("PERSONAL_TUTOR_NOT_FOUND");

    const teacher = await adminRepo.findProfessionalById(teacherProfessionalId, "teacher");
    if (!teacher) throw new Error("TEACHER_NOT_FOUND");

    await adminRepo.assignTeacherToStudent(personalTutorId, teacherProfessionalId);

    // Calculate teacher commission (fire-and-forget — never throws)
    await commissionService.calculateTeacherCommission(personalTutorId, teacherProfessionalId);

    return { message: "Teacher assigned successfully." };
};

exports.assignTrainer = async (individualParticipantId, trainerProfessionalId) => {
    const ip = await adminRepo.findIndividualParticipantById(individualParticipantId);
    if (!ip) throw new Error("INDIVIDUAL_PARTICIPANT_NOT_FOUND");

    const trainer = await adminRepo.findProfessionalById(trainerProfessionalId, "trainer");
    if (!trainer) throw new Error("TRAINER_NOT_FOUND");

    await adminRepo.assignTrainerToStudent(individualParticipantId, trainerProfessionalId);

    // Calculate trainer commission (fire-and-forget — never throws)
    await commissionService.calculateTrainerCommission(individualParticipantId, trainerProfessionalId);

    return { message: "Trainer assigned successfully." };
};

// ── Commission rules ───────────────────────────────────────────────────────

exports.listCommissionRules = async () => {
    const rules = await adminRepo.getAllCommissionRules();
    return rules;
};

exports.updateCommissionRule = async (ruleKey, newValue) => {
    const rule = await adminRepo.getCommissionRuleByKey(ruleKey);
    if (!rule) throw new Error("RULE_NOT_FOUND");

    const updated = await adminRepo.updateCommissionRule(ruleKey, newValue);
    return updated;
};

// ── Commissions list ───────────────────────────────────────────────────────

exports.listCommissions = async (filters) => {
    return await adminRepo.listCommissions(filters);
};

exports.markCommissionPaid = async (id) => {
    const commission = await adminRepo.getCommissionById(id);
    if (!commission) throw new Error("COMMISSION_NOT_FOUND");
    if (commission.status === "paid") throw new Error("ALREADY_PAID");

    return await adminRepo.markCommissionPaid(id);
};

// ── Travelling allowances list ─────────────────────────────────────────────

exports.listTravellingAllowances = async (filters) => {
    return await adminRepo.listTravellingAllowances(filters);
};

exports.markTravellingAllowancePaid = async (id) => {
    const ta = await adminRepo.getTravellingAllowanceById(id);
    if (!ta) throw new Error("TA_NOT_FOUND");
    if (ta.status === "paid") throw new Error("ALREADY_PAID");

    return await adminRepo.markTravellingAllowancePaid(id);
};

// ── Reject registration ────────────────────────────────────────────────────

exports.rejectRegistration = async (pendingId, adminUserId, note) => {
    const pending = await adminRepo.getById(pendingId);

    if (!pending) throw new Error("PENDING_NOT_FOUND");
    if (pending.status !== "pending") throw new Error("ALREADY_REVIEWED");

    await adminRepo.markReviewed(null, pendingId, "rejected", adminUserId, note);
    return { message: "Registration rejected." };
};

// ── Approval handlers ──────────────────────────────────────────────────────

async function approveTrainer(tx, data) {
    const { id: userId, uuid } = await trainerRepo.insertUser(tx, data);
    const professionalId = await trainerRepo.insertProfessional(tx, data, userId, uuid);
    await trainerRepo.insertTrainer(tx, data, professionalId);
}

async function approveTeacher(tx, data) {
    const { id: userId, uuid } = await teacherRepo.insertUser(tx, data);
    const professionalId = await teacherRepo.insertProfessional(tx, data, userId, uuid);
    await teacherRepo.insertTeacher(tx, data, professionalId);
}

async function approveVendor(tx, data) {
    const { id: userId, uuid } = await vendorRepo.insertUser(tx, data);
    const professionalId = await vendorRepo.insertProfessional(tx, data, userId, uuid);
    await vendorRepo.insertVendors(tx, data, professionalId);
}

async function approveMarketingExecutive(tx, data) {
    const { id: userId, uuid } = await meRepo.insertUser(tx, data);
    const professionalId = await meRepo.insertProfessional(tx, data, userId, uuid);
    await meRepo.insertMarketexe(tx, data, professionalId);
}

async function approveSocietyRequest(tx, data) {
    const userId    = await societyRepo.insertUser(tx, data);
    const societyId = await societyRepo.insertSociety(tx, data, userId, null);
    // No ME on a direct request — commission will be skipped by calculateMEOnboardingCommission
    return {
        id:                societyId,
        me_professional_id: null,
        no_of_flats:       data.noOfFlats ? Number(data.noOfFlats) : 0,
    };
}

async function approveSocietyEnrollment(tx, data) {
    const professional = await societyRepo.findProfessionalByReferralCode(tx, data.referralCode);
    if (!professional) throw new Error("Referral code is no longer valid.");
    const userId    = await societyRepo.insertUser(tx, data);
    const societyId = await societyRepo.insertSociety(tx, data, userId, professional.id);
    return {
        id:                societyId,
        me_professional_id: professional.id,
        no_of_flats:       data.noOfFlats ? Number(data.noOfFlats) : 0,
    };
}

exports.listActivities = async (coachingType) => {
    if (!coachingType) return activitiesRepo.getAllActiveActivities();
    return activitiesRepo.getActivitiesByCoachingType(coachingType);
};
