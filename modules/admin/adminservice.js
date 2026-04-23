const prisma = require("../../config/prisma");
const adminRepo = require("./adminrepository");
const activitiesRepo = require("../activities/activitiesrepository");
const trainerRepo = require("../professionals/trainer/trainerrepository");
const teacherRepo = require("../professionals/teacher/teacherepository");
const vendorRepo = require("../professionals/vendor/vendorregistration/vendorrepository");
const meRepo = require("../professionals/marketingExe/Registration-form/marketexerepository");
const societyRepo = require("../student/society/societyrepo");
const commissionService = require("../commissions/commissionservice");

const SOCIETY_CATEGORY_DISPLAY = { A_: "A+", A: "A", B: "B", custom: "custom" };

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
        id:                   f.id,
        coaching_type:        f.coaching_type,
        society_category:     f.society_category ? (SOCIETY_CATEGORY_DISPLAY[f.society_category] ?? f.society_category) : null,
        custom_category_name: f.custom_category_name ?? null,
        standard:             f.standard ?? null,
        term_months:          f.term_months,
        total_fee:            parseFloat(f.total_fee),
        effective_monthly:    f.effective_monthly !== null ? parseFloat(f.effective_monthly) : null,
        last_edited_by:       f.last_edited_by ?? null,
        last_edited_at:       f.last_edited_at ?? null,
    });

    if (section === "society") {
        // Society (group_coaching): group by activity → then by society_category (A+/A/B/custom name)
        return rows.map((a) => {
            const byCategory = {};
            for (const f of a.fee_structures) {
                const cat = f.society_category === "custom"
                    ? (f.custom_category_name ?? "custom")
                    : (SOCIETY_CATEGORY_DISPLAY[f.society_category] ?? f.society_category ?? "ALL");
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push({
                    id:                f.id,
                    term_months:       f.term_months,
                    total_fee:         parseFloat(f.total_fee),
                    effective_monthly: f.effective_monthly !== null ? parseFloat(f.effective_monthly) : null,
                });
            }
            return { activity_id: a.id, activity_name: a.name, by_category: byCategory };
        });
    }

    if (section === "school") {
        // School: group by activity → then by custom_category_name (or "default" for no category)
        return rows.map((a) => {
            const byCategory = {};
            for (const f of a.fee_structures) {
                const cat = f.society_category === "custom"
                    ? (f.custom_category_name ?? "custom")
                    : "default";
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push({
                    id:                f.id,
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
            membership_start_date: r.membership_start_date ?? null,
            membership_end_date: r.membership_end_date ?? null,
            term_months: r.term_months ?? null,
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
            membership_start_date: r.membership_start_date ?? null,
            membership_end_date: r.membership_end_date ?? null,
            term_months: r.term_months ?? null,
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

    if (type === "school_student") {
        const [rows, allActivities] = await Promise.all([
            adminRepo.getAllSchoolStudents(),
            prisma.activities.findMany({ select: { id: true, name: true } }),
        ]);
        const activityMap = Object.fromEntries(allActivities.map((a) => [a.id, a.name]));

        const resolveActivities = (raw) => {
            if (!raw) return [];
            try {
                const ids = typeof raw === "string" ? JSON.parse(raw) : raw;
                if (!Array.isArray(ids)) return [String(raw)];
                return ids.map((id) => activityMap[id] ?? String(id));
            } catch {
                return [String(raw)];
            }
        };

        return rows.map((r) => ({
            school_student_id: r.id,
            student_name: r.student_name ?? r.students?.users?.full_name ?? null,
            mobile: r.students?.users?.mobile ?? null,
            standard: r.standard,
            activities: resolveActivities(r.activities),
            kit_type: r.kit_type,
            school_id: r.schools?.id ?? null,
            school_name: r.schools?.school_name ?? null,
            created_at: r.created_at,
        }));
    }

    if (type === "group_coaching") {
        const rows = await adminRepo.getAllGroupCoachingStudents();
        return rows.map((r) => ({
            individual_participant_id: r.id,
            student_name: r.students?.users?.full_name ?? null,
            mobile: r.students?.users?.mobile ?? null,
            activity: r.activity,
            flat_no: r.flat_no,
            dob: r.dob,
            age: r.age,
            kits: r.kits,
            society_id: r.society_id ?? r.societies?.id ?? null,
            society_name: r.society_name ?? r.societies?.society_name ?? null,
        }));
    }

    throw new Error("INVALID_TYPE");
};

exports.getProfessional = async (professionalId) => {
    const r = await adminRepo.getProfessionalById(professionalId);
    if (!r) throw Object.assign(new Error("PROFESSIONAL_NOT_FOUND"), { status: 404 });

    const typeDetails = r.trainers?.[0] ?? r.teachers?.[0] ?? r.marketing_executives?.[0] ?? r.vendors?.[0] ?? null;

    // Build a structured documents map: { label, url } — only include uploaded ones
    const docs = [];
    if (r.users?.photo)                              docs.push({ label: "Photo",                url: r.users.photo });
    if (r.pan_card)                                  docs.push({ label: "PAN Card",             url: r.pan_card });
    if (r.adhar_card)                                docs.push({ label: "Aadhaar Card",         url: r.adhar_card });
    if (typeDetails?.qualification_docs)             docs.push({ label: "Highest Qualification",url: typeDetails.qualification_docs });
    if (typeDetails?.documents)                      docs.push({ label: "Other Documents",      url: typeDetails.documents });
    if (typeDetails?.ded_doc)                        docs.push({ label: "D.Ed Certificate",     url: typeDetails.ded_doc });
    if (typeDetails?.bed_doc)                        docs.push({ label: "B.Ed Certificate",     url: typeDetails.bed_doc });
    if (typeDetails?.other_doc)                      docs.push({ label: "Other Documents",      url: typeDetails.other_doc });
    if (typeDetails?.activity_agreement_pdf)         docs.push({ label: "Agreement File",       url: typeDetails.activity_agreement_pdf });
    if (typeDetails?.gst_certificate)                docs.push({ label: "GST Certificate",      url: typeDetails.gst_certificate });

    return {
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
        details: typeDetails,
        documents: docs,
    };
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

/**
 * Returns group_coaching students for a batch's assign dropdown.
 * Filtered by society + activity, excludes students already in the batch.
 */
/**
 * Returns school_student students for a batch's assign dropdown.
 * Filtered by school + activity, excludes students already in the batch.
 */
exports.getSchoolStudentsForBatch = async (batchId, schoolId, activityId) => {
    if (!batchId || !schoolId) {
        const err = new Error("batchId and school_id are required");
        err.status = 400;
        throw err;
    }
    const rows = await adminRepo.getSchoolStudentsForBatch(batchId, schoolId, activityId);
    return rows.map(r => ({
        student_id:   r.students?.id ?? null,
        full_name:    r.students?.users?.full_name ?? r.student_name ?? null,
        mobile:       r.students?.users?.mobile ?? null,
        standard:     r.standard,
        school_id:    r.school_id,
        activities:   r.activities,
    }));
};

exports.getGroupCoachingStudentsForBatch = async (batchId, societyId, activityId) => {
    if (!batchId || !societyId) {
        const err = new Error("batchId and society_id are required");
        err.status = 400;
        throw err;
    }
    const rows = await adminRepo.getGroupCoachingStudentsForBatch(batchId, societyId, activityId);
    return rows.map(r => ({
        student_id:   r.students?.id ?? null,
        full_name:    r.students?.users?.full_name ?? null,
        mobile:       r.students?.users?.mobile ?? null,
        activity:     r.activity,
        society_id:   r.society_id,
        society_name: r.society_name,
        batch_id:     r.batch_id,  // null = unassigned, non-null = already in another batch
    }));
};

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

// service.js
exports.getApprovedSocieties = async () => {
    const rows = await adminRepo.getApprovedSocieties();
    return rows.map((r) => ({
        ...r,
        participant_count: r._count?.participants || 0,
        society_category: r.society_category ? (SOCIETY_CATEGORY_DISPLAY[r.society_category] ?? r.society_category) : null,
    }));
};

exports.getSocietyDetails = async (id) => {
    return await adminRepo.getSocietyParticipants(id);
};

exports.getApprovedSchools = async () => {
    return await adminRepo.getApprovedSchools();
};

// ── Fee structure custom categories dropdown ──────────────────────────────

exports.listCustomFeeCategories = async (type) => {
    const coachingType = type === "school" ? "school_student" : "group_coaching";
    return await adminRepo.getCustomFeeCategories(coachingType);
};

// ── Fee structure upsert ───────────────────────────────────────────────────

const VALID_COACHING_TYPES = ["school_student", "group_coaching", "individual_coaching", "personal_tutor"];

exports.deleteFeeStructure = async (id) => {
    const existing = await adminRepo.getFeeStructureById(id);
    if (!existing) throw new Error("FEE_STRUCTURE_NOT_FOUND");
    return await adminRepo.deleteFeeStructureById(id);
};

exports.upsertFeeStructure = async (feeData, adminUserId, feeId) => {
    if (feeId) {
        const existing = await adminRepo.getFeeStructureById(Number(feeId));
        if (!existing) throw new Error("FEE_STRUCTURE_NOT_FOUND");
        return await adminRepo.updateFeeStructureById(feeId, {
            total_fee:            feeData.total_fee,
            effective_monthly:    feeData.effective_monthly,
            custom_category_name: feeData.custom_category_name,
            adminUserId,
        });
    }
    if (!VALID_COACHING_TYPES.includes(feeData.coaching_type)) throw new Error("INVALID_COACHING_TYPE");
    const societyCategory = feeData.society_category === "A+" ? "A_" : (feeData.society_category ?? null);
    // When society_category is 'custom', custom_category_name is required
    if (societyCategory === "custom" && !feeData.custom_category_name) {
        throw new Error("CUSTOM_CATEGORY_NAME_REQUIRED");
    }
    return await adminRepo.createFeeStructure({ ...feeData, society_category: societyCategory, adminUserId });
};

// ── Admin societies ────────────────────────────────────────────────────────

const SOCIETY_CAT_DISPLAY = { A_: "A+", A: "A", B: "B", custom: "custom" };

exports.getAllSocietiesAdmin = async () => {
    const rows = await adminRepo.getAllSocietiesAdmin();
    return rows.map((r) => ({
        ...r,
        society_category: r.society_category ? (SOCIETY_CAT_DISPLAY[r.society_category] ?? r.society_category) : null,
        student_count: r._count?.individual_participants ?? 0,
        me: r.professionals
            ? { professional_id: r.professionals.id, full_name: r.professionals.users?.full_name ?? null, referral_code: r.professionals.referral_code }
            : null,
        _count: undefined,
        professionals: undefined,
    }));
};

exports.getSocietyAdminById = async (id) => {
    const r = await adminRepo.getSocietyAdminById(Number(id));
    if (!r) throw new Error("SOCIETY_NOT_FOUND");
    return {
        ...r,
        society_category: r.society_category ? (SOCIETY_CAT_DISPLAY[r.society_category] ?? r.society_category) : null,
        me: r.professionals
            ? { professional_id: r.professionals.id, full_name: r.professionals.users?.full_name ?? null, referral_code: r.professionals.referral_code }
            : null,
        professionals: undefined,
        individual_participants: (r.individual_participants ?? []).map((p) => ({
            id: p.id,
            participant_name: p.students?.users?.full_name ?? null,
            mobile: p.students?.users?.mobile ?? null,
            flat_no: p.flat_no,
            dob: p.dob,
            age: p.age,
            activity: p.activity,
            kits: p.kits,
        })),
    };
};

exports.adminRegisterSociety = async (data, adminUserId) => {
    let meProfessionalId = null;
    if (data.referralCode) {
        const me = await adminRepo.findMEByReferralCode(data.referralCode);
        if (!me) throw new Error("ME_NOT_FOUND");
        meProfessionalId = me.id;
    }
    const societyId = await adminRepo.adminInsertSociety(data, meProfessionalId, adminUserId);
    if (meProfessionalId) {
        commissionService.calculateMEOnboardingCommission("society", {
            id: societyId,
            me_professional_id: meProfessionalId,
            no_of_flats: data.noOfFlats ? Number(data.noOfFlats) : 0,
        }).catch(() => {});
    }
    return { message: "Society registered.", society_id: societyId };
};

// ── Admin schools ──────────────────────────────────────────────────────────

exports.getAllSchoolsAdmin = async () => {
    const rows = await adminRepo.getAllSchoolsAdmin();
    return rows.map((r) => ({
        ...r,
        student_count: r._count?.school_students ?? 0,
        me: r.professionals
            ? { professional_id: r.professionals.id, full_name: r.professionals.users?.full_name ?? null, referral_code: r.professionals.referral_code }
            : null,
        _count: undefined,
        professionals: undefined,
    }));
};

exports.getSchoolAdminById = async (id) => {
    const r = await adminRepo.getSchoolAdminById(Number(id));
    if (!r) throw new Error("SCHOOL_NOT_FOUND");

    const allIds = [];
    for (const s of r.school_students ?? []) {
        if (s.activities) {
            for (const part of s.activities.split(",")) {
                const n = parseInt(part.trim(), 10);
                if (!isNaN(n)) allIds.push(n);
            }
        }
    }
    const activityRows = await adminRepo.getActivitiesByIds([...new Set(allIds)]);
    const activityMap = Object.fromEntries(activityRows.map((a) => [a.id, a.name]));

    return {
        ...r,
        me: r.professionals
            ? { professional_id: r.professionals.id, full_name: r.professionals.users?.full_name ?? null, referral_code: r.professionals.referral_code }
            : null,
        professionals: undefined,
        school_students: (r.school_students ?? []).map((s) => {
            const names = (s.activities ?? "")
                .split(",")
                .map((p) => {
                    const n = parseInt(p.trim(), 10);
                    return isNaN(n) ? null : (activityMap[n] ?? null);
                })
                .filter(Boolean);
            return { ...s, activities: names };
        }),
    };
};

exports.adminRegisterSchool = async (data, adminUserId) => {
    let meProfessionalId = null;
    if (data.referralCode) {
        const me = await adminRepo.findMEByReferralCode(data.referralCode);
        if (!me) throw new Error("ME_NOT_FOUND");
        meProfessionalId = me.id;
    }
    const schoolId = await adminRepo.adminInsertSchool(data, meProfessionalId);
    if (meProfessionalId) {
        commissionService.calculateMEOnboardingCommission("school", {
            id: schoolId,
            me_professional_id: meProfessionalId,
        }).catch(() => {});
    }
    return { message: "School registered.", school_id: schoolId };
};

// ── ME dropdown ────────────────────────────────────────────────────────────

exports.getMEList = async () => {
    const rows = await adminRepo.getAllMEList();
    return rows.map((r) => ({
        professional_id: r.id,
        full_name: r.users?.full_name ?? null,
        referral_code: r.referral_code,
    }));
};

exports.assignTeacher = async (personalTutorId, teacherProfessionalId) => {
    const pt = await adminRepo.findPersonalTutorById(personalTutorId);
    if (!pt) throw new Error("PERSONAL_TUTOR_NOT_FOUND");

    const teacher = await adminRepo.findProfessionalById(teacherProfessionalId, "teacher");
    if (!teacher) throw new Error("TEACHER_NOT_FOUND");

    await adminRepo.assignTeacherToStudent(personalTutorId, teacherProfessionalId);

    // Record assignment for settlement (fire-and-forget)
    await commissionService.recordTeacherAssignment(personalTutorId, teacherProfessionalId);

    return { message: "Teacher assigned successfully." };
};

exports.assignTrainer = async (individualParticipantId, trainerProfessionalId) => {
    const ip = await adminRepo.findIndividualParticipantById(individualParticipantId);
    if (!ip) throw new Error("INDIVIDUAL_PARTICIPANT_NOT_FOUND");

    const trainer = await adminRepo.findProfessionalById(trainerProfessionalId, "trainer");
    if (!trainer) throw new Error("TRAINER_NOT_FOUND");

    await adminRepo.assignTrainerToStudent(individualParticipantId, trainerProfessionalId);

    // Record assignment for settlement (fire-and-forget)
    await commissionService.recordTrainerAssignment(individualParticipantId, trainerProfessionalId);

    return { message: "Trainer assigned successfully." };
};

// ── Settlement ─────────────────────────────────────────────────────────────

/**
 * GET /admin/professionals/:professionalId/settlement-preview
 *
 * Returns the "Sessions & Settle" tab data for a single professional.
 * Produces one card per active group-coaching batch and one card per
 * individual-coaching / personal-tutor student, along with the
 * calculated trainer_earns amount ready to settle.
 *
 * Formula:
 *   per_session_rate  = (effective_monthly_fee_sum × commission_rate) / session_cap
 *   trainer_earns     = completed_sessions_since_last_settlement × per_session_rate
 *
 * session_cap = the commission-rules cap (e.g. 20 for group_society_sports).
 *              It is the denominator — never the number of sessions created.
 */
exports.getSessionsAndSettlePreview = async (professionalId) => {
    const pid = Number(professionalId);
    const items = await commissionService.previewSettlement(pid);
    const prisma = require("../../config/prisma");

    const formatDate = (d) =>
        new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const results = [];

    for (const item of items) {
        const isIndividual = item.assignment_type === "personal_tutor" || item.assignment_type === "individual_coaching";

        const cycleStart = item.last_settled_at
            ? new Date(item.last_settled_at)
            : new Date(item.assigned_from);

        // Cycle window: windowStart → windowStart + 1 month (same as buildSettlementItem)
        const cycleWindowEnd = new Date(cycleStart);
        cycleWindowEnd.setMonth(cycleWindowEnd.getMonth() + 1);

        const sessionType = item.assignment_type === "personal_tutor"     ? "personal_tutor"
                          : item.assignment_type === "individual_coaching" ? "individual_coaching"
                          : null;

        // ── For PT/IC: split into one card per activity_id ───────────────
        // Sessions carry activity_id; the personal_tutors record holds teacher_for as a
        // comma-separated string. We group by activity_id directly from the sessions table.
        if (isIndividual && sessionType) {
            // Fetch all sessions in this cycle window grouped by activity_id
            const cycleSessions = await prisma.sessions.findMany({
                where: {
                    professional_id: pid,
                    session_type:    sessionType,
                    scheduled_date:  { gte: cycleStart, lte: cycleWindowEnd },
                },
                select: { activity_id: true, status: true, scheduled_date: true, student_id: true },
            });

            // Group by activity_id (null treated as its own group)
            const activityGroups = {};
            for (const s of cycleSessions) {
                const key = s.activity_id ?? "null";
                if (!activityGroups[key]) activityGroups[key] = [];
                activityGroups[key].push(s);
            }

            // Fetch activity names for all activity_ids in one query
            const activityIds = Object.keys(activityGroups)
                .filter((k) => k !== "null")
                .map(Number);
            const activityRows = activityIds.length > 0
                ? await prisma.activities.findMany({ where: { id: { in: activityIds } }, select: { id: true, name: true } })
                : [];
            const activityNameMap = Object.fromEntries(activityRows.map((a) => [a.id, a.name]));

            // Fetch student info for display (PT or IC)
            const now = new Date();
            const studentIds = [...new Set(cycleSessions.map((s) => s.student_id).filter(Boolean))];

            let studentInfoMap = {}; // student_id → { name, mobile, membership_end_date, effective_monthly }
            if (item.assignment_type === "personal_tutor" && studentIds.length > 0) {
                const ptRows = await prisma.personal_tutors.findMany({
                    where: { student_id: { in: studentIds } },
                    select: { student_id: true, membership_end_date: true, term_months: true,
                              students: { select: { users: { select: { full_name: true, mobile: true } } } } },
                });
                const feeMap = new Map((item.student_fee_breakdown ?? []).map((s) => [s.student_id, s]));
                for (const r of ptRows) {
                    studentInfoMap[r.student_id] = {
                        name:               r.students?.users?.full_name ?? "—",
                        mobile:             r.students?.users?.mobile ?? null,
                        membership_end_date: r.membership_end_date ?? null,
                        effective_monthly:  feeMap.get(r.student_id)?.effective_monthly ?? null,
                        term_months:        r.term_months ?? null,
                    };
                }
            } else if (item.assignment_type === "individual_coaching" && studentIds.length > 0) {
                const icRows = await prisma.individual_participants.findMany({
                    where: { student_id: { in: studentIds } },
                    select: { student_id: true, membership_end_date: true, term_months: true,
                              students: { select: { users: { select: { full_name: true, mobile: true } } } } },
                });
                const feeMap = new Map((item.student_fee_breakdown ?? []).map((s) => [s.student_id, s]));
                for (const r of icRows) {
                    studentInfoMap[r.student_id] = {
                        name:               r.students?.users?.full_name ?? "—",
                        mobile:             r.students?.users?.mobile ?? null,
                        membership_end_date: r.membership_end_date ?? null,
                        effective_monthly:  feeMap.get(r.student_id)?.effective_monthly ?? null,
                        term_months:        r.term_months ?? null,
                    };
                }
            }

            // Resolve membership_end_date for cycle display (first student)
            const membershipEndDate = studentIds.length > 0
                ? (studentInfoMap[studentIds[0]]?.membership_end_date ?? null)
                : null;
            const cycleEnd = membershipEndDate ? new Date(membershipEndDate) : cycleWindowEnd;

            // Commission rules for per-session calculation
            const commissionRate = item.commission_rate ?? 80;
            const standardCap   = item.standard_sessions_cap ?? 18;

            // Build one card per activity group
            for (const [actKey, sessions] of Object.entries(activityGroups)) {
                const activityId   = actKey === "null" ? null : Number(actKey);
                const activityName = activityId ? (activityNameMap[activityId] ?? `Activity ${activityId}`) : "General";

                const completed = sessions.filter((s) => s.status === "completed" && new Date(s.scheduled_date) <= now).length;
                const absent    = sessions.filter((s) => s.status === "absent"    && new Date(s.scheduled_date) <= now).length;
                const upcoming  = sessions.filter((s) => ["scheduled", "ongoing"].includes(s.status) && new Date(s.scheduled_date) >= now).length;
                const totalInWindow = sessions.length;

                // autoCap: actual session count in window, clamped to standardCap
                const autoCap = Math.min(Math.max(totalInWindow, 1), standardCap);

                // Per-activity fee base: divide the total fee base proportionally by activity count
                const activityCount = Object.keys(activityGroups).length;
                const effectiveFeeBase = parseFloat(((item.effective_fee_base ?? 0) / activityCount).toFixed(2));

                const totalCommissionPool  = parseFloat(((effectiveFeeBase * commissionRate) / 100).toFixed(2));
                const commissionPerSession = autoCap > 0 ? parseFloat((totalCommissionPool / autoCap).toFixed(2)) : 0;
                const sessionsAttended     = Math.min(completed, standardCap);
                const trainerEarns         = parseFloat((sessionsAttended * commissionPerSession).toFixed(2));

                // Students involved in this activity's sessions
                const actStudentIds = [...new Set(sessions.map((s) => s.student_id).filter(Boolean))];
                const students = actStudentIds.map((sid) => {
                    const info = studentInfoMap[sid] ?? {};
                    return {
                        student_id:         sid,
                        name:               info.name ?? "—",
                        mobile:             info.mobile ?? null,
                        activity:           activityName,
                        term_months:        info.term_months ?? null,
                        effective_monthly:  info.effective_monthly ?? null,
                        sessions_completed: sessions.filter((s) => s.student_id === sid && s.status === "completed" && new Date(s.scheduled_date) <= now).length,
                        sessions_absent:    sessions.filter((s) => s.student_id === sid && s.status === "absent"    && new Date(s.scheduled_date) <= now).length,
                        sessions_upcoming:  sessions.filter((s) => s.student_id === sid && ["scheduled","ongoing"].includes(s.status) && new Date(s.scheduled_date) >= now).length,
                    };
                });

                results.push({
                    assignment_id:   item.assignment_id,
                    assignment_type: item.assignment_type,
                    card_type:       item.assignment_type,
                    activity_id:     activityId,
                    professional_id:   pid,
                    professional_name: item.professional_name,
                    professional_type: item.professional_type,
                    entity_name:       null,
                    activity_name:     activityName,
                    batch_info:        null,
                    session_cycle:     `${formatDate(cycleStart)} – ${formatDate(cycleEnd)}`,
                    last_settled_at:   item.last_settled_at ?? null,
                    monthly_cap:       standardCap,
                    effective_cap:     autoCap,
                    sessions_completed:  sessionsAttended,
                    sessions_completed_raw: completed,
                    sessions_upcoming:  upcoming,
                    sessions_absent:    absent,
                    attendance_pct:     (completed + absent) > 0 ? Math.round((completed / (completed + absent)) * 100) : 0,
                    student_count:      actStudentIds.length,
                    effective_fee_base: effectiveFeeBase,
                    commission_rate:    commissionRate,
                    is_flat_rate:       false,
                    flat_amount_per_session: null,
                    commission_per_session:  commissionPerSession,
                    trainer_earns:      trainerEarns,
                    overdue_warning:    null,
                    students,
                });
            }

            continue; // skip the generic push below for this item
        }

        // ── Group coaching (society / school): one card as before ────────
        const wasClamped = item.sessions_attended_raw > item.sessions_attended;

        const assignment = {
            id:              item.assignment_id,
            professional_id: pid,
            assignment_type: item.assignment_type,
            society_id:      item.society_id  ?? null,
            school_id:       item.school_id   ?? null,
            activity_id:     item.activity_id ?? null,
            assigned_from:   item.assigned_from,
            last_settled_at: item.last_settled_at,
        };
        const extras = await adminRepo.getAssignmentSessionExtras(assignment);

        const cycleEnd = extras.membership_end_date
            ? new Date(extras.membership_end_date)
            : new Date();

        const feeMap    = new Map((item.student_fee_breakdown ?? []).map((s) => [s.student_id, s]));
        const extrasMap = new Map((extras.students ?? []).map((s) => [s.student_id, s]));
        const allStudentIds = new Set([...feeMap.keys(), ...extrasMap.keys()]);
        const mergedStudents = [...allStudentIds].map((sid) => {
            const fee    = feeMap.get(sid)    ?? {};
            const counts = extrasMap.get(sid) ?? {};
            return {
                student_id:           sid,
                name:                 fee.name              ?? counts.name              ?? "—",
                mobile:               fee.mobile            ?? counts.mobile            ?? null,
                activity:             fee.activity          ?? counts.activity          ?? null,
                term_months:          fee.term_months       ?? counts.term_months       ?? null,
                service_type:         counts.service_type   ?? null,
                society_category:     counts.society_category     ?? null,
                custom_category_name: counts.custom_category_name ?? null,
                effective_monthly:    fee.effective_monthly ?? null,
                sessions_completed:   counts.sessions_completed ?? 0,
                sessions_absent:      counts.sessions_absent    ?? 0,
                sessions_upcoming:    counts.sessions_upcoming  ?? 0,
            };
        });

        const cardType =
            item.assignment_type === "group_coaching_society" ? "society"  :
            item.assignment_type === "group_coaching_school"  ? "school"   :
            "other";

        results.push({
            assignment_id:   item.assignment_id,
            assignment_type: item.assignment_type,
            card_type:       cardType,
            professional_id:   pid,
            professional_name: item.professional_name,
            professional_type: item.professional_type,
            entity_name:   extras.batch_info?.entity_name   ?? item.entity_name   ?? null,
            activity_name: extras.batch_info?.activity_name ?? item.activity_name ?? null,
            batch_info:    extras.batch_info ?? null,
            session_cycle:   `${formatDate(cycleStart)} – ${formatDate(cycleEnd)}`,
            last_settled_at: item.last_settled_at ?? null,
            monthly_cap:            item.standard_sessions_cap,
            effective_cap:          item.effective_sessions_cap,
            sessions_completed:     item.sessions_attended,
            sessions_completed_raw: item.sessions_attended_raw,
            sessions_upcoming:      extras.upcoming_sessions ?? 0,
            sessions_absent:        extras.absent_sessions   ?? 0,
            attendance_pct:         extras.attendance_pct    ?? 0,
            student_count:      mergedStudents.length,
            effective_fee_base: item.effective_fee_base,
            commission_rate:         item.commission_rate,
            is_flat_rate:            item.is_flat_rate,
            flat_amount_per_session: item.flat_amount_per_session,
            commission_per_session:  item.commission_per_session,
            trainer_earns:           item.commission_amount,
            overdue_warning: wasClamped
                ? `${item.sessions_attended_raw} sessions completed but capped at ${item.sessions_attended} (monthly cap). Settle monthly to avoid missing sessions.`
                : null,
            students: mergedStudents,
        });
    }

    return results;
};

/**
 * POST /admin/professionals/:professionalId/settle
 *
 * "Settle Amount" button handler.
 *
 * Settles all unsettled (or the specified) assignments for one professional,
 * creating a commissions record per assignment at status = "pending".
 * Once created the amount appears in the trainer's Payouts tab immediately.
 *
 * Body (optional):
 *   { assignment_ids: [1, 2, 3], cap_overrides: { "5": 15 } }
 *
 * If assignment_ids is omitted, ALL active assignments for this professional
 * are settled.
 */
exports.settleAmountForProfessional = async (professionalId, assignmentIds = null, capOverrides = {}) => {
    const pid = Number(professionalId);

    // Validate professional exists
    const professional = await prisma.professionals.findUnique({
        where:  { id: pid },
        select: { id: true, profession_type: true, users: { select: { full_name: true } } },
    });
    if (!professional) throw Object.assign(new Error("PROFESSIONAL_NOT_FOUND"), { status: 404 });

    // Scope to this professional only
    const settled = await commissionService.confirmSettlement(
        assignmentIds ? assignmentIds.map(Number) : null,
        capOverrides,
        pid          // professional filter (see updated confirmSettlement below)
    );

    return {
        professional_id:   pid,
        professional_name: professional.users?.full_name ?? null,
        settled_count:     settled.filter((s) => !s.skipped && !s.error).length,
        skipped_count:     settled.filter((s) => s.skipped).length,
        items:             settled,
    };
};

exports.getSettlementPreview = async (professionalId) => {
    return await commissionService.previewSettlement(professionalId ?? null);
};

exports.confirmSettlement = async (assignmentIds, capOverrides = {}) => {
    return await commissionService.confirmSettlement(assignmentIds ?? null, capOverrides);
};

exports.listTrainerAssignments = async ({ professionalId, isActive } = {}) => {
    return await adminRepo.listTrainerAssignments({ professionalId, isActive });
};

exports.updateAssignmentSessionsCap = async (assignmentId, sessionsAllocated) => {
    if (!sessionsAllocated || sessionsAllocated < 1)
        throw new Error("INVALID_SESSIONS_ALLOCATED");
    return await adminRepo.updateAssignmentSessionsCap(assignmentId, sessionsAllocated);
};

exports.deactivateAssignment = async (assignmentId) => {
    return await adminRepo.deactivateAssignment(assignmentId);
};

exports.getUnsettledCount = async () => {
    const count = await adminRepo.countUnsettledAssignments(30);
    return { unsettled_count: count };
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

exports.approveCommission = async (id) => {
    const commission = await adminRepo.getCommissionById(id);
    if (!commission) throw new Error("COMMISSION_NOT_FOUND");
    if (commission.status !== "on_hold" && commission.status !== "pending")
        throw new Error("COMMISSION_NOT_APPROVABLE");

    return await adminRepo.approveCommission(id);
};

exports.markCommissionPaid = async (id) => {
    const commission = await adminRepo.getCommissionById(id);
    if (!commission) throw new Error("COMMISSION_NOT_FOUND");
    if (commission.status === "paid")                              throw new Error("ALREADY_PAID");
    if (commission.status === "on_hold" || commission.status === "pending") throw new Error("COMMISSION_NOT_APPROVED");

    const amount = parseFloat(commission.commission_amount);
    return await adminRepo.markCommissionPaid(id, amount, commission.professional_id);
};

// ── Withdrawal requests (removed — admin pays manually via markCommissionPaid) ─

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

const cloudinary = require("../../config/cloudinary");

const extractPublicId = (url) => {
    // e.g. https://res.cloudinary.com/.../fitnesta/activities/activity-123.jpg
    const match = url.match(/fitnesta\/activities\/[^/.]+/);
    return match ? match[0] : null;
};

exports.createActivity = async ({ name, notes, activity_category, image_url, fee_structures, adminUserId }) => {
    if (!name)              throw new Error("ACTIVITY_NAME_REQUIRED");
    if (!activity_category) throw new Error("ACTIVITY_CATEGORY_REQUIRED");

    // Validate fee_structures if provided
    const fees = Array.isArray(fee_structures) ? fee_structures : [];
    for (const f of fees) {
        if (!f.coaching_type || !f.term_months || f.total_fee == null) {
            throw new Error("INVALID_FEE_STRUCTURE");
        }
        if (!VALID_COACHING_TYPES.includes(f.coaching_type)) throw new Error("INVALID_COACHING_TYPE");
    }

    return await adminRepo.createActivityWithFees({ name, notes, activity_category, image_url }, fees, adminUserId);
};

exports.updateActivity = async (id, body) => {
    const existing = await adminRepo.getActivityById(id);
    if (!existing) throw new Error("ACTIVITY_NOT_FOUND");

    // If a new image was uploaded and there was an old one, delete old from Cloudinary
    if (body.image_url && existing.image_url && body.image_url !== existing.image_url) {
        const publicId = extractPublicId(existing.image_url);
        if (publicId) cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    return await adminRepo.updateActivity(id, body);
};

exports.deleteActivity = async (id, force = false) => {
    const existing = await adminRepo.getActivityById(id);
    if (!existing) throw new Error("ACTIVITY_NOT_FOUND");

    if (force) {
        const hasHistory = await adminRepo.activityHasHistory(id);
        if (hasHistory) throw new Error("ACTIVITY_HAS_HISTORY");
        if (existing.image_url) {
            const publicId = extractPublicId(existing.image_url);
            if (publicId) cloudinary.uploader.destroy(publicId).catch(() => {});
        }
        return await adminRepo.hardDeleteActivity(id);
    }

    // Default: soft delete
    return await adminRepo.updateActivity(id, { is_active: false });
};

// ── Admin Profit ───────────────────────────────────────────────────────────

/**
 * GET /admin/dashboard/profit-stats
 *
 * Shows the admin's total profit — i.e. the share Fitnesta KEEPS from every
 * commission cycle.
 *
 * How it works (per commission row):
 *   base_amount       = total monthly fees billed on that settlement cycle
 *   commission_amount = what the professional (trainer / teacher / ME) earned
 *   admin_profit      = base_amount − commission_amount   ← admin's cut
 *
 * Example:
 *   Student pays ₹5,000/month.
 *   Trainer's rate is 80 % → trainer earns ₹4,000 (commission_amount).
 *   Admin keeps  20 % → ₹1,000 profit on that row.
 *
 * Status buckets for reporting:
 *   on_hold  → commission held until threshold (20 students) is met — partial profit locked
 *   pending  → commission raised but not yet approved by admin
 *   approved → admin approved, payment pending
 *   paid     → fully settled; this is "realised profit"
 */
exports.getAdminProfitStats = async ({ from, to } = {}) => {
    return await adminRepo.getAdminProfitStats({ from, to });
};

// ── Payments ──────────────────────────────────────────────────────────────

exports.listPayments = async (filters) => {
    const rows = await adminRepo.listPayments(filters);
    return rows.map((r) => ({
        id: r.id,
        razorpay_order_id: r.razorpay_order_id,
        razorpay_payment_id: r.razorpay_payment_id,
        service_type: r.service_type,
        amount: parseFloat(r.amount),
        currency: r.currency,
        term_months: r.term_months,
        status: r.status,
        captured_at: r.captured_at,
        user: r.users ? { id: r.users.id, full_name: r.users.full_name, mobile: r.users.mobile } : null,
    }));
};

exports.listPayIns = async ({ serviceType, from, to } = {}) => {
    const rows = await adminRepo.listPayIns({ serviceType, from, to });
    const total = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    return {
        total: parseFloat(total.toFixed(2)),
        count: rows.length,
        items: rows.map((r) => ({
            id:                  r.id,
            razorpay_payment_id: r.razorpay_payment_id,
            service_type:        r.service_type,
            amount:              parseFloat(r.amount),
            currency:            r.currency,
            term_months:         r.term_months,
            captured_at:         r.captured_at,
            user: r.users ? { id: r.users.id, full_name: r.users.full_name, mobile: r.users.mobile } : null,
        })),
    };
};

exports.listPayOuts = async ({ professionalType, commissionStatus, refundStatus, from, to } = {}) => {
    const [commissions, refunds] = await Promise.all([
        adminRepo.listPayOutCommissions({ professionalType, status: commissionStatus, from, to }),
        adminRepo.listPayOutRefunds({ status: refundStatus, from, to }),
    ]);

    const commissionItems = commissions.map((c) => ({
        type:              "commission",
        id:                c.id,
        professional_type: c.professional_type,
        source_type:       c.source_type,
        source_id:         c.source_id,
        amount:            parseFloat(c.commission_amount),
        status:            c.status,
        created_at:        c.created_at,
        professional: c.professionals ? {
            id:        c.professionals.id,
            full_name: c.professionals.users?.full_name,
            mobile:    c.professionals.users?.mobile,
        } : null,
    }));

    const refundItems = refunds.map((r) => ({
        type:         "kit_refund",
        id:           r.id,
        kit_order_id: r.kit_order_id,
        amount:       parseFloat(r.amount),
        reason:       r.reason,
        status:       r.status,
        created_at:   r.created_at,
        product_name: r.kit_orders?.vendor_products?.product_name ?? null,
        razorpay_payment_id: r.kit_orders?.razorpay_payment_id ?? null,
        user: r.users ? { id: r.users.id, full_name: r.users.full_name, mobile: r.users.mobile } : null,
    }));

    const allItems = [...commissionItems, ...refundItems]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = allItems.reduce((sum, i) => sum + i.amount, 0);

    return {
        total:              parseFloat(total.toFixed(2)),
        commission_count:   commissionItems.length,
        refund_count:       refundItems.length,
        items:              allItems,
    };
};

exports.markRefundProcessed = async (refundId) => {
    const refund = await adminRepo.getRefundById(refundId);
    if (!refund) throw Object.assign(new Error("REFUND_NOT_FOUND"), { status: 404 });
    if (refund.status === "processed") throw Object.assign(new Error("ALREADY_PROCESSED"), { status: 409 });
    return await adminRepo.markRefundProcessed(refundId);
};

// ── Student assignment overview (read-only) ───────────────────────────────

exports.listStudentAssignments = async (service) => {
    if (service === "personal_tutor") {
        const rows = await adminRepo.getAllPersonalTutors();
        return rows.map((r) => ({
            personal_tutor_id: r.id,
            student_id: r.students?.id ?? null,
            student_name: r.students?.users?.full_name ?? null,
            student_mobile: r.students?.users?.mobile ?? null,
            standard: r.standard,
            batch: r.batch,
            teacher_for: r.teacher_for,
            assigned: r.teacher_professional_id !== null,
            assigned_teacher: r.teacher_professional_id
                ? {
                    professional_id: r.professionals?.id,
                    name: r.professionals?.users?.full_name ?? null,
                    subject: r.professionals?.teachers?.[0]?.subject ?? null,
                }
                : null,
        }));
    }

    if (service === "individual_coaching") {
        const rows = await adminRepo.getAllIndividualParticipants();
        return rows.map((r) => ({
            individual_participant_id: r.id,
            student_id: r.students?.id ?? null,
            student_name: r.students?.users?.full_name ?? null,
            student_mobile: r.students?.users?.mobile ?? null,
            activity: r.activity,
            society: r.society_name ?? null,
            assigned: r.trainer_professional_id !== null,
            assigned_trainer: r.trainer_professional_id
                ? {
                    professional_id: r.professionals?.id,
                    name: r.professionals?.users?.full_name ?? null,
                    specified_game: r.professionals?.trainers?.[0]?.specified_game ?? null,
                }
                : null,
        }));
    }

    // Return both when no filter
    const [pt, ic] = await Promise.all([
        exports.listStudentAssignments("personal_tutor"),
        exports.listStudentAssignments("individual_coaching"),
    ]);
    return { personal_tutor: pt, individual_coaching: ic };
};

// ── Sessions ──────────────────────────────────────────────────────────────

exports.listSessions = async (filters) => {
    return await adminRepo.listSessions(filters);
};

exports.createSession = async (body) => {
    const { session_type, date, start_time, end_time, professional_id, student_id, batch_id, activity_id } = body;
    if (!session_type || !date || !start_time || !end_time || !professional_id) {
        throw new Error("MISSING_REQUIRED_FIELDS");
    }
    const parseTime = (t) => {
        const [h, m, s = "0"] = String(t).split(":");
        return new Date(1970, 0, 1, Number(h), Number(m), Number(s));
    };
    return await adminRepo.createSession({
        session_type,
        scheduled_date: new Date(date),
        start_time: parseTime(start_time),
        end_time: parseTime(end_time),
        professional_id: Number(professional_id),
        ...(student_id  && { student_id:  Number(student_id) }),
        ...(batch_id    && { batch_id:    Number(batch_id) }),
        ...(activity_id && { activity_id: Number(activity_id) }),
    });
};

exports.getSessionStudentInfo = async (type, id) => {
    if (type === "personal_tutor") {
        const r = await adminRepo.getPersonalTutorForSession(id);
        if (!r) throw new Error("NOT_FOUND");
        const consent = r.students?.parent_consents?.[0] ?? null;
        return {
            type: "personal_tutor",
            personal_tutor_id: r.id,
            student_id: r.students?.id ?? null,
            student_name: r.students?.users?.full_name ?? null,
            student_mobile: r.students?.users?.mobile ?? null,
            student_address: r.students?.users?.address ?? null,
            standard: r.standard,
            subject: r.teacher_for,
            preferred_time: r.preferred_time ?? null,
            parent_name: consent?.parent_name ?? null,
            parent_mobile: consent?.emergency_contact_no ?? null,
            already_assigned_professional_id: r.teacher_professional_id ?? null,
        };
    }
    if (type === "individual_coaching") {
        const r = await adminRepo.getIndividualParticipantForSession(id);
        if (!r) throw new Error("NOT_FOUND");
        const consent = r.students?.parent_consents?.[0] ?? null;
        return {
            type: "individual_coaching",
            individual_participant_id: r.id,
            student_id: r.students?.id ?? null,
            student_name: r.students?.users?.full_name ?? null,
            student_mobile: r.students?.users?.mobile ?? null,
            student_address: r.students?.users?.address ?? null,
            activity: r.activity,
            society_name: r.society_name ?? r.societies?.society_name ?? null,
            society_address: r.societies?.address ?? null,
            preferred_batch: r.preferred_batch ?? null,
            preferred_time: r.preferred_time ?? null,
            parent_name: consent?.parent_name ?? null,
            parent_mobile: consent?.emergency_contact_no ?? null,
            already_assigned_professional_id: r.trainer_professional_id ?? null,
        };
    }
    throw new Error("INVALID_TYPE");
};

exports.getProfessionalsForSession = async (type, filters) => {
    if (type !== "teacher" && type !== "trainer") throw new Error("INVALID_TYPE");
    return await adminRepo.getProfessionalsForSession(type, filters);
};

// ── Personal tutor session creation helpers ───────────────────────────────

// Returns the subjects a personal_tutor student is enrolled in, as a clean list
exports.getStudentSubjects = async (studentId) => {
    const tutor = await prisma.personal_tutors.findFirst({
        where: { student_id: Number(studentId) },
        select: { teacher_for: true, standard: true, term_months: true },
    });
    if (!tutor) throw new Error("NOT_FOUND");

    const standard = tutor.standard;
    const rawSubjects = (tutor.teacher_for || "").split(",").map((s) => s.trim()).filter(Boolean);

    const subjectNames = rawSubjects.map((s) => (/^All Subjects/i.test(s) ? "All Subjects" : s));

    // Resolve activity records for each subject name
    const activities = await prisma.activities.findMany({
        where: { name: { in: subjectNames } },
        select: { id: true, name: true },
    });

    // Fetch session cap from commission_rules
    const capRule = await prisma.commission_rules.findUnique({ where: { rule_key: "personal_tutor_sessions_cap" } });
    const session_cap_per_month = capRule ? parseInt(capRule.value) : 18;

    // Return exactly what the student purchased — no expansion of "All Subjects" into individual subjects
    return {
        student_id:           Number(studentId),
        standard,
        term_months:          tutor.term_months,
        session_cap_per_month,
        subjects: activities.map((a) => ({ activity_id: a.id, activity_name: a.name })),
    };
};

// Returns teachers who teach a given subject, with availability for an optional time slot
// Returns the activities an individual_coaching student is enrolled in
exports.getStudentActivities = async (studentId) => {
    const participant = await prisma.individual_participants.findFirst({
        where: { student_id: Number(studentId) },
        select: { activity: true, term_months: true },
    });
    if (!participant) throw new Error("NOT_FOUND");

    // activity is a comma-separated display string e.g. "Dance (Western), Boxing"
    const activityNames = (participant.activity || "")
        .split(",").map((s) => s.trim()).filter(Boolean);

    // Fetch session cap from commission_rules
    const capRule = await prisma.commission_rules.findUnique({ where: { rule_key: "individual_coaching_sessions_cap" } });
    const session_cap_per_month = capRule ? parseInt(capRule.value) : 18;

    if (!activityNames.length) return { student_id: Number(studentId), term_months: participant.term_months, session_cap_per_month, activities: [] };

    const activities = await prisma.activities.findMany({
        where: { name: { in: activityNames } },
        select: { id: true, name: true },
    });

    return { student_id: Number(studentId), term_months: participant.term_months, session_cap_per_month, activities };
};

// Returns trainers for a given activity, with availability for an optional slot
exports.getTrainersForActivity = async (activityId, filters = {}) => {
    const activity = await prisma.activities.findUnique({
        where: { id: Number(activityId) },
        select: { id: true, name: true },
    });
    if (!activity) throw new Error("NOT_FOUND");

    const result = await adminRepo.getProfessionalsForSession("trainer", {
        ...filters,
        activityId: activity.id,
    });
    return result;
};

exports.getTeachersForSubject = async (activityId, filters = {}) => {
    const activity = await prisma.activities.findUnique({
        where: { id: Number(activityId) },
        select: { id: true, name: true },
    });
    if (!activity) throw new Error("NOT_FOUND");

    const result = await adminRepo.getProfessionalsForSession("teacher", {
        ...filters,
        subject: activity.name,
    });
    return result;
};

// ── Batches per society/school ────────────────────────────────────────────

exports.getSocietyBatches = async (id) => {
    const rows = await adminRepo.getBatchesBySociety(id);
    return rows.map((r) => ({
        id: r.id,
        batch_type: r.batch_type,
        batch_name: r.batch_name,
        days_of_week: r.days_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        start_date: r.start_date,
        end_date: r.end_date,
        is_active: r.is_active,
        activity: r.activities ? { id: r.activities.id, name: r.activities.name } : null,
        professional: r.professionals
            ? {
                id: r.professionals.id,
                type: r.professionals.profession_type,
                name: r.professionals.users?.full_name ?? null,
            }
            : null,
        student_count: r._count?.batch_students ?? 0,
    }));
};

exports.getSchoolBatches = async (id) => {
    const rows = await adminRepo.getBatchesBySchool(id);
    return rows.map((r) => ({
        id: r.id,
        batch_type: r.batch_type,
        batch_name: r.batch_name,
        days_of_week: r.days_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        start_date: r.start_date,
        end_date: r.end_date,
        is_active: r.is_active,
        activity: r.activities ? { id: r.activities.id, name: r.activities.name } : null,
        professional: r.professionals
            ? {
                id: r.professionals.id,
                type: r.professionals.profession_type,
                name: r.professionals.users?.full_name ?? null,
            }
            : null,
        student_count: r._count?.batch_students ?? 0,
    }));
};


// ── Legal content ──────────────────────────────────────────────────────────

const VALID_DASHBOARD_TYPES = ["trainer", "teacher", "marketing_executive", "vendor", "student"];
const VALID_CONTENT_TYPES   = ["terms_and_conditions", "privacy_and_policy"];

exports.upsertLegalContent = async ({ dashboard_type, content_type, content }, adminUserId) => {
    if (!dashboard_type || !VALID_DASHBOARD_TYPES.includes(dashboard_type)) {
        throw Object.assign(new Error("INVALID_DASHBOARD_TYPE"), { status: 400 });
    }
    if (!content_type || !VALID_CONTENT_TYPES.includes(content_type)) {
        throw Object.assign(new Error("INVALID_CONTENT_TYPE"), { status: 400 });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
        throw Object.assign(new Error("CONTENT_REQUIRED"), { status: 400 });
    }

    return await prisma.legal_content.upsert({
        where: { dashboard_type_content_type: { dashboard_type, content_type } },
        update: { content: content.trim(), updated_by: adminUserId ?? null },
        create: { dashboard_type, content_type, content: content.trim(), updated_by: adminUserId ?? null },
    });
};

exports.getLegalContent = async ({ dashboard_type, content_type }) => {
    const where = {};
    if (dashboard_type) where.dashboard_type = dashboard_type;
    if (content_type)   where.content_type   = content_type;
    return await prisma.legal_content.findMany({ where, orderBy: [{ dashboard_type: "asc" }, { content_type: "asc" }] });
};

// ── Support tickets ────────────────────────────────────────────────────────

exports.listSupportTickets = async ({ status } = {}) => {
    const tickets = await prisma.support_tickets.findMany({
        where: status ? { status } : undefined,
        orderBy: { created_at: "desc" },
        include: {
            users: {
                select: {
                    id: true,
                    full_name: true,
                    mobile: true,
                    email: true,
                    role: true,
                    subrole: true,
                    photo: true,
                    students: {
                        select: { id: true, student_type: true },
                        take: 1,
                    },
                    professionals: {
                        select: { id: true, profession_type: true, place: true },
                        take: 1,
                    },
                },
            },
        },
    });

    return tickets.map((t) => {
        const u = t.users;
        const student = u.students?.[0] ?? null;
        const professional = u.professionals?.[0] ?? null;

        return {
            id: t.id,
            message: t.message,
            status: t.status,
            resolved_at: t.resolved_at,
            created_at: t.created_at,
            user: {
                id: u.id,
                full_name: u.full_name,
                mobile: u.mobile,
                email: u.email,
                photo: u.photo,
                role: u.role,
                subrole: u.subrole,
                // For students: student_type (personal_tutor | individual_coaching | school_student | …)
                student_type: student?.student_type ?? null,
                student_id: student?.id ?? null,
                // For professionals: profession_type (trainer | teacher | marketing_executive | vendor)
                profession_type: professional?.profession_type ?? null,
                professional_id: professional?.id ?? null,
                place: professional?.place ?? null,
            },
        };
    });
};

exports.resolveSupportTicket = async (ticketId, adminUserId) => {
    const ticket = await prisma.support_tickets.findUnique({ where: { id: Number(ticketId) } });
    if (!ticket) throw Object.assign(new Error("TICKET_NOT_FOUND"), { status: 404 });
    if (ticket.status === "resolved") throw Object.assign(new Error("ALREADY_RESOLVED"), { status: 409 });

    return await prisma.support_tickets.update({
        where: { id: Number(ticketId) },
        data: { status: "resolved", resolved_at: new Date(), resolved_by: adminUserId ?? null },
        select: { id: true, status: true, resolved_at: true },
    });
};

// ── Audit logs ────────────────────────────────────────────────────────────

exports.getAuditLogs = async (filters) => {
    return adminRepo.getAuditLogs(filters);
};

// ── Sub-admin management (super_admin only) ────────────────────────────────

exports.listAdmins = async () => {
    const rows = await adminRepo.listAdmins();
    return rows.map((a) => ({
        admin_id:   a.id,
        user_id:    a.users.id,
        full_name:  a.users.full_name,
        mobile:     a.users.mobile,
        email:      a.users.email,
        scope:      a.scope,
        created_at: a.created_at,
    }));
};

exports.createSubAdmin = async ({ full_name, mobile, email }) => {
    if (!full_name || !mobile) throw Object.assign(new Error("MISSING_REQUIRED_FIELDS"), { status: 400 });

    const existing = await adminRepo.findUserByMobile(mobile);
    if (existing) throw Object.assign(new Error("MOBILE_ALREADY_EXISTS"), { status: 409 });

    const { user, adminRow } = await adminRepo.createSubAdmin({ full_name, mobile, email });
    return {
        admin_id:   adminRow.id,
        user_id:    user.id,
        full_name:  user.full_name,
        mobile:     user.mobile,
        email:      user.email,
        scope:      adminRow.scope,
        created_at: adminRow.created_at,
    };
};

exports.removeSubAdmin = async (userId) => {
    const adminRow = await adminRepo.findAdminByUserId(userId);
    if (!adminRow) throw Object.assign(new Error("ADMIN_NOT_FOUND"), { status: 404 });
    if (adminRow.scope === "super_admin") throw Object.assign(new Error("CANNOT_REMOVE_SUPER_ADMIN"), { status: 403 });

    await adminRepo.removeSubAdmin(userId);
};

// ── User management (super_admin) ─────────────────────────────────────────

const { sendNotification } = require("../../utils/fcm");

exports.listUsers = async ({ role, subrole, search, limit, offset }) => {
    return adminRepo.listUsers({ role, subrole, search, limit, offset });
};

exports.getUserById = async (userId) => {
    const user = await adminRepo.getUserById(userId);
    if (!user) throw Object.assign(new Error("USER_NOT_FOUND"), { status: 404 });
    return user;
};

exports.editUser = async (userId, updates, adminId) => {
    const user = await adminRepo.getUserById(userId);
    if (!user) throw Object.assign(new Error("USER_NOT_FOUND"), { status: 404 });
    if (user.role === "admin") throw Object.assign(new Error("CANNOT_EDIT_ADMIN_USER"), { status: 403 });

    const data = {};
    const allowedFields = ["full_name", "email", "address", "photo"];
    for (const field of allowedFields) {
        if (updates[field] !== undefined) data[field] = updates[field];
    }

    // Mobile change — notify user
    const mobileChanged = updates.mobile && updates.mobile !== user.mobile;
    if (mobileChanged) {
        const cleanMobile = String(updates.mobile).replace("+91", "");
        // Check uniqueness
        const existing = await adminRepo.findUserByMobile(cleanMobile);
        if (existing && existing.id !== user.id) {
            throw Object.assign(new Error("MOBILE_ALREADY_IN_USE"), { status: 409 });
        }
        data.mobile = cleanMobile;
    }

    const updated = await adminRepo.updateUser(userId, data);

    // Send push notification AFTER successful update
    if (mobileChanged) {
        sendNotification(
            user.id,
            "Mobile Number Updated",
            `Your mobile number has been changed by admin. Please log in using your new number: ${data.mobile}`,
            { type: "mobile_changed", new_mobile: data.mobile }
        );
    }

    return updated;
};

exports.suspendUser = async (userId, adminId, note) => {
    const user = await adminRepo.getUserById(userId);
    if (!user) throw Object.assign(new Error("USER_NOT_FOUND"), { status: 404 });
    if (user.role === "admin") throw Object.assign(new Error("CANNOT_SUSPEND_ADMIN"), { status: 403 });
    if (user.is_suspended) throw Object.assign(new Error("USER_ALREADY_SUSPENDED"), { status: 409 });

    await adminRepo.suspendUser(userId, adminId, note);

    sendNotification(
        user.id,
        "Account Suspended",
        note ? `Your account has been suspended. Reason: ${note}` : "Your account has been suspended by admin. Please contact support.",
        { type: "account_suspended" }
    );

    return { message: "User suspended." };
};

exports.unsuspendUser = async (userId) => {
    const user = await adminRepo.getUserById(userId);
    if (!user) throw Object.assign(new Error("USER_NOT_FOUND"), { status: 404 });
    if (!user.is_suspended) throw Object.assign(new Error("USER_NOT_SUSPENDED"), { status: 409 });

    await adminRepo.unsuspendUser(userId);

    sendNotification(
        user.id,
        "Account Reinstated",
        "Your account suspension has been lifted. You can now log in again.",
        { type: "account_unsuspended" }
    );

    return { message: "User unsuspended." };
};

// ── Visiting Forms ────────────────────────────────────────────────────────────

const VALID_PLACE_TYPES        = ["society", "school", "organisation"];
const VALID_PERMISSION_STATUSES = ["granted", "not_granted", "follow_up"];

exports.listVisitingForms = async (filters) => {
    const page  = filters.page  ? Number(filters.page)  : 1;
    const limit = filters.limit ? Number(filters.limit) : 20;

    if (filters.placeType && !VALID_PLACE_TYPES.includes(filters.placeType)) {
        const err = new Error(`Invalid placeType. Allowed: ${VALID_PLACE_TYPES.join(", ")}`);
        err.status = 400;
        throw err;
    }
    if (filters.permissionStatus && !VALID_PERMISSION_STATUSES.includes(filters.permissionStatus)) {
        const err = new Error(`Invalid permissionStatus. Allowed: ${VALID_PERMISSION_STATUSES.join(", ")}`);
        err.status = 400;
        throw err;
    }

    const { total, rows } = await adminRepo.getAllVisitingForms({ ...filters, page, limit });

    const data = rows.map(r => ({
        id:                r.id,
        visit_date:        r.visit_date,
        visited_place:     r.visited_place,
        place_type:        r.place_type,
        place_name:        r.place_name,
        address:           r.address,
        contact_person:    r.contact_person,
        mobile_no:         r.mobile_no,
        secretary_name:    r.secretary_name,
        secretary_mobile:  r.secretary_mobile,
        principal_name:    r.principal_name,
        principal_mobile:  r.principal_mobile,
        chairman_name:     r.chairman_name,
        chairman_mobile:   r.chairman_mobile,
        remark:            r.remark,
        permission_status: r.permission_status,
        next_visit_date:   r.next_visit_date,
        created_at:        r.created_at,
        me: {
            professional_id: r.professionals?.id                 ?? null,
            user_id:         r.professionals?.users?.id          ?? null,
            name:            r.professionals?.users?.full_name   ?? null,
            mobile:          r.professionals?.users?.mobile      ?? null,
            email:           r.professionals?.users?.email       ?? null,
            photo:           r.professionals?.users?.photo       ?? null,
        },
    }));

    return { total, page, limit, data };
};

// ── Enriched Trainer/Teacher settlement preview ───────────────────────────

/**
 * GET /professionals/:id/sessions-settle
 *
 * Returns trainer/teacher assignments enriched with:
 *   - batch info (name, days, time, entity)
 *   - session counts: completed, upcoming, absent, attendance_pct
 *   - commission rate, per-session rate, trainer_earns
 *   - session_cycle string
 */
exports.getEnrichedSettlementPreview = async (professionalId) => {
    const pid   = Number(professionalId);
    const items = await commissionService.previewSettlement(pid);

    const formatDate = (d) =>
        new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    const results = [];
    for (const item of items) {
        const assignment = {
            id:              item.assignment_id,
            professional_id: item.professional_id,
            assignment_type: item.assignment_type,
            society_id:      item.society_id  ?? null,
            school_id:       item.school_id   ?? null,
            activity_id:     item.activity_id ?? null,
            assigned_from:   item.assigned_from,
            last_settled_at: item.last_settled_at,
        };

        const extras = await adminRepo.getAssignmentSessionExtras(assignment);

        const cycleStart = item.last_settled_at ? new Date(item.last_settled_at) : new Date(item.assigned_from);
        // For IC/PT: show membership end date as the cycle end (the full term window).
        // For group assignments membership_end_date is not available — fall back to today.
        const cycleEnd = extras.membership_end_date
            ? new Date(extras.membership_end_date)
            : new Date();

        const wasClamped = item.sessions_attended_raw > item.sessions_attended;

        results.push({
            assignment_id:          item.assignment_id,
            assignment_type:        item.assignment_type,
            entity_name:            extras.batch_info?.entity_name ?? item.entity_name,
            activity_name:          extras.batch_info?.activity_name ?? item.activity_name,
            batch_info:             extras.batch_info,
            session_cycle:          `${formatDate(cycleStart)} – ${formatDate(cycleEnd)}`,
            total_sessions_allocated: item.standard_sessions_cap,
            sessions_completed:     item.sessions_attended,        // clamped to monthly cap
            sessions_completed_raw: item.sessions_attended_raw,    // actual count before clamp
            upcoming_sessions:      extras.upcoming_sessions,
            absent_sessions:        extras.absent_sessions,
            attendance_pct:         extras.attendance_pct,
            commission_rate:        item.commission_rate,
            is_flat_rate:           item.is_flat_rate,
            flat_amount_per_session: item.flat_amount_per_session,
            commission_per_session: item.commission_per_session,
            effective_fee_base:     item.effective_fee_base,
            trainer_earns:          item.commission_amount,
            last_settled_at:        item.last_settled_at ?? null,
            overdue_warning:        wasClamped
                ? `${item.sessions_attended_raw} sessions completed but capped at ${item.sessions_attended} (monthly cap). Settle monthly to avoid missing sessions.`
                : null,
            students:               extras.students ?? [],
        });
    }

    return results;
};

/**
 * GET /professionals/:id/payouts
 * Returns commissions list for a professional (their Payouts tab).
 */
exports.getProfessionalPayouts = async (professionalId) => {
    const pid = Number(professionalId);
    const rows = await adminRepo.getProfessionalCommissions(pid);

    return rows.map((c, idx) => ({
        id:               c.id,
        serial:           idx + 1,
        source_type:      c.source_type,
        description:      c.description ?? null,
        base_amount:      c.base_amount      ? parseFloat(c.base_amount)      : null,
        commission_rate:  c.commission_rate  ? parseFloat(c.commission_rate)  : null,
        commission_amount: parseFloat(c.commission_amount),
        status:           c.status,
        created_at:       c.created_at,
    }));
};

// ── ME settlement preview ─────────────────────────────────────────────────

/**
 * GET /professionals/:id/me-settlement-preview
 *
 * For each society the ME manages: activities, student count.
 * Admin uses this to see what the ME is owed and to settle per society.
 */
exports.getMESettlementPreview = async (professionalId) => {
    const pid  = Number(professionalId);
    const rows = await adminRepo.getMESocietySummary(pid);
    return rows;
};

/**
 * GET /professionals/:id/me-societies/:societyId/describe
 *
 * Returns student-level breakdown for the "Describe Settlement" modal.
 * Includes upfront fee paid and 5% ME earns per student.
 */
exports.getMESettlementDescribe = async (professionalId, societyId) => {
    const pid = Number(professionalId);
    const sid = Number(societyId);

    const rules = await prisma.commission_rules.findMany();
    const ruleMap = Object.fromEntries(rules.map((r) => [r.rule_key, parseFloat(r.value)]));
    const meRate  = ruleMap["me_group_admission_rate"] ?? 5;

    const data = await adminRepo.getMESocietySettlementDescribe(sid, pid, meRate);
    if (!data) throw Object.assign(new Error("SOCIETY_NOT_FOUND"), { status: 404 });
    return data;
};

/**
 * POST /professionals/:id/me-societies/:societyId/settle
 *
 * Settle ME commission for a society.
 * Rules:
 *  - Minimum 20 students must be enrolled in the society.
 *  - Commission must not already be in pending/approved/paid state.
 *  - Releases all on_hold commissions for that society to pending.
 */
exports.settleMECommission = async (professionalId, societyId) => {
    const pid = Number(professionalId);
    const sid = Number(societyId);

    // Verify professional exists and is ME
    const professional = await prisma.professionals.findUnique({
        where:  { id: pid },
        select: { id: true, profession_type: true, users: { select: { full_name: true } } },
    });
    if (!professional) throw Object.assign(new Error("PROFESSIONAL_NOT_FOUND"), { status: 404 });
    if (professional.profession_type !== "marketing_executive")
        throw Object.assign(new Error("NOT_A_MARKETING_EXECUTIVE"), { status: 400 });

    // 20-student threshold check
    const rules = await prisma.commission_rules.findMany();
    const ruleMap = Object.fromEntries(rules.map((r) => [r.rule_key, parseFloat(r.value)]));
    const minStudents = ruleMap["me_group_admission_min_students"] ?? 20;

    const studentCount = await adminRepo.countSocietyStudents(sid);
    if (studentCount < minStudents) {
        throw Object.assign(
            new Error(`THRESHOLD_NOT_MET: ${studentCount} of ${minStudents} students enrolled`),
            { status: 400 }
        );
    }

    // Check not already settled
    const existing = await adminRepo.getMECommissionForSociety(pid, sid);
    if (existing) throw Object.assign(new Error("ALREADY_SETTLED"), { status: 409 });

    // Release all on_hold commissions for this society → pending
    const updated = await prisma.commissions.updateMany({
        where: {
            professional_id:   pid,
            professional_type: "marketing_executive",
            entity_id:         sid,
            status:            "on_hold",
        },
        data: { status: "pending" },
    });

    return {
        professional_id:   pid,
        society_id:        sid,
        commissions_released: updated.count,
        message: `${updated.count} commission(s) moved to pending.`,
    };
};

// ── Vendor panel ──────────────────────────────────────────────────────────

/**
 * GET /professionals/:id/vendor-panel
 *
 * Returns vendor's listed products and recent orders with breakup:
 *   base_price, transport, profit_share (90%), settlement amount.
 */
exports.getVendorPanel = async (professionalId) => {
    const pid  = Number(professionalId);
    const data = await adminRepo.getVendorPanelData(pid);
    if (!data) throw Object.assign(new Error("VENDOR_NOT_FOUND"), { status: 404 });
    return data;
};

/**
 * POST /professionals/:id/vendor-orders/:orderId/settle
 *
 * Settle a vendor's kit order commission: move from pending → pending in payouts
 * (commission was created at in_progress; this confirms it for payout processing).
 * Actually the commission is already at "pending" — this endpoint approves it
 * so it's visible as approved and ready for payment.
 */
exports.settleVendorOrder = async (professionalId, orderId) => {
    const pid = Number(professionalId);
    const oid = Number(orderId);

    const commission = await adminRepo.getVendorOrderCommission(pid, oid);
    if (!commission) throw Object.assign(new Error("COMMISSION_NOT_FOUND"), { status: 404 });
    if (commission.status === "approved" || commission.status === "paid")
        throw Object.assign(new Error("ALREADY_SETTLED"), { status: 409 });

    await prisma.commissions.update({
        where: { id: commission.id },
        data:  { status: "pending" },
    });

    return {
        commission_id:    commission.id,
        professional_id:  pid,
        order_id:         oid,
        commission_amount: parseFloat(commission.commission_amount),
        status:           "pending",
        message:          "Order settlement moved to pending payout.",
    };
};

exports.getVisitingFormByIdAdmin = async (formId) => {
    const r = await adminRepo.getVisitingFormByIdAdmin(Number(formId));
    if (!r) {
        const err = new Error("Visiting form not found.");
        err.status = 404;
        throw err;
    }
    return {
        id:                r.id,
        visit_date:        r.visit_date,
        visited_place:     r.visited_place,
        place_type:        r.place_type,
        place_name:        r.place_name,
        address:           r.address,
        contact_person:    r.contact_person,
        mobile_no:         r.mobile_no,
        secretary_name:    r.secretary_name,
        secretary_mobile:  r.secretary_mobile,
        principal_name:    r.principal_name,
        principal_mobile:  r.principal_mobile,
        chairman_name:     r.chairman_name,
        chairman_mobile:   r.chairman_mobile,
        remark:            r.remark,
        permission_status: r.permission_status,
        next_visit_date:   r.next_visit_date,
        created_at:        r.created_at,
        me: {
            professional_id: r.professionals?.id                 ?? null,
            user_id:         r.professionals?.users?.id          ?? null,
            name:            r.professionals?.users?.full_name   ?? null,
            mobile:          r.professionals?.users?.mobile      ?? null,
            email:           r.professionals?.users?.email       ?? null,
            photo:           r.professionals?.users?.photo       ?? null,
        },
    };
};

// ── Student detail + edit ─────────────────────────────────────────────────

exports.getStudentDetail = async (studentId) => {
    const row = await adminRepo.getStudentDetail(studentId);
    if (!row) throw Object.assign(new Error("NOT_FOUND"), { status: 404 });
    return row;
};

/**
 * PATCH /admin/students/:studentId
 *
 * Body can contain:
 *   user          — { full_name, mobile, email, address }
 *   personal_tutor (id required) — any personal_tutors fields
 *   individual_participant (id required) — any individual_participants fields
 *   school_student (id required) — any school_students fields
 *
 * Only provided keys are updated (partial update).
 */
exports.updateStudentDetail = async (studentId, body) => {
    const sid = Number(studentId);
    const updates = [];

    if (body.user && Object.keys(body.user).length) {
        const student = await prisma.students.findUnique({ where: { id: sid }, select: { user_id: true } });
        if (!student) throw Object.assign(new Error("NOT_FOUND"), { status: 404 });
        if (student.user_id) {
            const allowedUserFields = ["full_name", "mobile", "email", "address", "photo"];
            const userData = {};
            for (const key of allowedUserFields) {
                if (body.user[key] !== undefined) userData[key] = body.user[key];
            }
            if (Object.keys(userData).length) {
                updates.push(prisma.users.update({ where: { id: student.user_id }, data: userData }));
            }
        }
    }

    if (body.individual_participant?.id) {
        const { id, ...rest } = body.individual_participant;
        const allowed = [
            "participant_name","mobile","flat_no","dob","age","society_id","society_name",
            "activity","kits","preferred_batch","preferred_time","term_months",
            "membership_start_date","membership_end_date","session_cap",
            "session_days_of_week","session_start_time","session_end_time","is_active",
        ];
        const data = {};
        for (const key of allowed) {
            if (rest[key] !== undefined) {
                data[key] = (key === "dob" || key === "membership_start_date" || key === "membership_end_date")
                    ? new Date(rest[key]) : rest[key];
            }
        }
        if (Object.keys(data).length) {
            updates.push(adminRepo.updateIndividualParticipant(id, data));
        }
    }

    if (body.personal_tutor?.id) {
        const { id, ...rest } = body.personal_tutor;
        const allowed = [
            "dob","standard","batch","teacher_for","preferred_time","term_months",
            "membership_start_date","membership_end_date","session_cap",
            "session_days_of_week","session_start_time","session_end_time","is_active",
        ];
        const data = {};
        for (const key of allowed) {
            if (rest[key] !== undefined) {
                data[key] = (key === "dob" || key === "membership_start_date" || key === "membership_end_date")
                    ? new Date(rest[key]) : rest[key];
            }
        }
        if (Object.keys(data).length) {
            updates.push(adminRepo.updatePersonalTutor(id, data));
        }
    }

    if (body.school_student?.id) {
        const { id, ...rest } = body.school_student;
        const allowed = [
            "student_name","standard","address","activities","kit_type","term_months",
            "membership_start_date","membership_end_date","is_active",
        ];
        const data = {};
        for (const key of allowed) {
            if (rest[key] !== undefined) {
                data[key] = (key === "membership_start_date" || key === "membership_end_date")
                    ? new Date(rest[key]) : rest[key];
            }
        }
        if (Object.keys(data).length) {
            updates.push(adminRepo.updateSchoolStudent(id, data));
        }
    }

    if (!updates.length) throw Object.assign(new Error("NO_UPDATES"), { status: 400 });

    await Promise.all(updates);
    return adminRepo.getStudentDetail(studentId);
};
