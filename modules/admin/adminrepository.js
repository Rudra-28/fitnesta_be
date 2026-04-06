const prisma = require("../../config/prisma");

// ── Approved professionals list ───────────────────────────────────────────

exports.getApprovedProfessionals = async (type) => {
    return await prisma.professionals.findMany({
        where: {
            ...(type && { profession_type: type }),
            users: { approval_status: "approved" },
        },
        select: {
            id: true,
            profession_type: true,
            referral_code: true,
            place: true,
            date: true,
            own_two_wheeler: true,
            communication_languages: true,
            pan_card: true,
            adhar_card: true,
            relative_name: true,
            relative_contact: true,
            users: {
                select: {
                    id: true,
                    full_name: true,
                    mobile: true,
                    email: true,
                    address: true,
                    photo: true,
                    created_at: true,
                },
            },
            trainers: {
                select: {
                    player_level: true,
                    category: true,
                    specified_game: true,
                    specified_skills: true,
                    experience_details: true,
                    qualification_docs: true,
                    documents: true,
                },
            },
            teachers: {
                select: {
                    subject: true,
                    experience_details: true,
                    ded_doc: true,
                    bed_doc: true,
                    other_doc: true,
                },
            },
            marketing_executives: {
                select: {
                    dob: true,
                    education_qualification: true,
                    previous_experience: true,
                    activity_agreement_pdf: true,
                },
            },
            vendors: {
                select: {
                    store_name: true,
                    store_address: true,
                    store_location: true,
                    gst_certificate: true,
                },
            },
            wallets: {
                select: { balance: true },
            },
        },
        orderBy: { id: "desc" },
    });
};

// ── Unassigned students ────────────────────────────────────────────────────

exports.getUnassignedPersonalTutors = async () => {
    return await prisma.personal_tutors.findMany({
        where: { teacher_professional_id: null },
        select: {
            id: true,
            standard: true,
            batch: true,
            teacher_for: true,
            dob: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

exports.getUnassignedIndividualParticipants = async () => {
    return await prisma.individual_participants.findMany({
        where: { trainer_professional_id: null },
        select: {
            id: true,
            activity: true,
            flat_no: true,
            society_name: true,
            dob: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

// ── All students (assigned + unassigned) ──────────────────────────────────

exports.getAllPersonalTutors = async () => {
    return await prisma.personal_tutors.findMany({
        select: {
            id: true,
            standard: true,
            batch: true,
            teacher_for: true,
            dob: true,
            // Who is assigned (null if not yet assigned)
            teacher_professional_id: true,
            professionals: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                    teachers: { select: { subject: true } },
                },
            },
            // Student & user info
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

exports.getAllIndividualParticipants = async () => {
    return await prisma.individual_participants.findMany({
        select: {
            id: true,
            activity: true,
            flat_no: true,
            society_name: true,
            dob: true,
            age: true,
            kits: true,
            // Who is assigned (null if not yet assigned)
            trainer_professional_id: true,
            professionals: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                    trainers: { select: { category: true, specified_game: true } },
                },
            },
            // Student & user info
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

// ── Fee structures ────────────────────────────────────────────────────────

exports.getFeeStructures = async (coachingType) => {
    return await prisma.activities.findMany({
        where: {
            is_active: true,
            fee_structures: {
                some: coachingType ? { coaching_type: coachingType } : {},
            },
        },
        select: {
            id: true,
            name: true,
            fee_structures: {
                where: coachingType ? { coaching_type: coachingType } : {},
                select: {
                    id: true,
                    coaching_type: true,
                    society_category: true,
                    custom_category_name: true,
                    standard: true,
                    term_months: true,
                    total_fee: true,
                    effective_monthly: true,
                    last_edited_by: true,
                    last_edited_at: true,
                },
                orderBy: [
                    { society_category: "asc" },
                    { standard: "asc" },
                    { term_months: "asc" },
                ],
            },
        },
        orderBy: { name: "asc" },
    });
};

// ── Societies & Schools (for batch creation dropdowns) ────────────────────

exports.getApprovedSocieties = async () => {
    return await prisma.societies.findMany({
        where: { approval_status: "approved" },
        select: { id: true, society_name: true, society_category: true, address: true },
        orderBy: { society_name: "asc" },
    });
};

exports.getApprovedSchools = async () => {
    return await prisma.schools.findMany({
        where: { approval_status: "approved" },
        select: { id: true, school_name: true, address: true },
        orderBy: { school_name: "asc" },
    });
};

// ── Available professionals ────────────────────────────────────────────────

// When date/startTime/endTime are provided, professionals with a conflicting
// session at that slot are excluded from the result.
exports.getAvailableTeachers = async ({ date, startTime, endTime } = {}) => {
    let busyIds = new Set();
    if (date && startTime && endTime) {
        const rows = await prisma.sessions.findMany({
            where: {
                scheduled_date: new Date(date),
                status: { notIn: ["cancelled"] },
                AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
                professionals: { profession_type: "teacher" },
            },
            select: { professional_id: true },
            distinct: ["professional_id"],
        });
        busyIds = new Set(rows.map((r) => r.professional_id));
    }

    const all = await prisma.professionals.findMany({
        where: {
            profession_type: "teacher",
            users: { approval_status: "approved" },
        },
        select: {
            id: true,
            users: { select: { full_name: true, mobile: true } },
            teachers: { select: { subject: true, experience_details: true } },
        },
    });

    return all.filter((p) => !busyIds.has(p.id));
};

exports.getAvailableTrainers = async ({ date, startTime, endTime } = {}) => {
    let busyIds = new Set();
    if (date && startTime && endTime) {
        const rows = await prisma.sessions.findMany({
            where: {
                scheduled_date: new Date(date),
                status: { notIn: ["cancelled"] },
                AND: [{ start_time: { lt: endTime } }, { end_time: { gt: startTime } }],
                professionals: { profession_type: "trainer" },
            },
            select: { professional_id: true },
            distinct: ["professional_id"],
        });
        busyIds = new Set(rows.map((r) => r.professional_id));
    }

    const all = await prisma.professionals.findMany({
        where: {
            profession_type: "trainer",
            users: { approval_status: "approved" },
        },
        select: {
            id: true,
            users: { select: { full_name: true, mobile: true } },
            trainers: { select: { category: true, specified_game: true, experience_details: true } },
        },
    });

    return all.filter((p) => !busyIds.has(p.id));
};

// ── Assign professional ────────────────────────────────────────────────────

exports.assignTeacherToStudent = async (personalTutorId, teacherProfessionalId) => {
    return await prisma.personal_tutors.update({
        where: { id: personalTutorId },
        data: { teacher_professional_id: teacherProfessionalId },
    });
};

exports.assignTrainerToStudent = async (individualParticipantId, trainerProfessionalId) => {
    return await prisma.individual_participants.update({
        where: { id: individualParticipantId },
        data: { trainer_professional_id: trainerProfessionalId },
    });
};

// ── Validation helpers ─────────────────────────────────────────────────────

exports.findPersonalTutorById = async (id) => {
    return await prisma.personal_tutors.findUnique({ where: { id } });
};

exports.findIndividualParticipantById = async (id) => {
    return await prisma.individual_participants.findUnique({ where: { id } });
};

exports.findProfessionalById = async (id, type) => {
    return await prisma.professionals.findFirst({
        where: { id, profession_type: type },
        select: { id: true, profession_type: true },
    });
};

// Student types are registered automatically after payment — never need admin approval
const STUDENT_SERVICE_TYPES = ["personal_tutor", "individual_coaching", "school_student"];

exports.getAllPending = async (serviceType) => {
    return await prisma.pending_registrations.findMany({
        where: {
            status: "pending",
            service_type: serviceType
                ? serviceType
                : { notIn: STUDENT_SERVICE_TYPES },
        },
        select: {
            id: true,
            temp_uuid: true,
            service_type: true,
            form_data: true,
            created_at: true,
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getById = async (id) => {
    return await prisma.pending_registrations.findFirst({
        where: { id: Number(id) },
    });
};

// ── Commission rules ───────────────────────────────────────────────────────

exports.getAllCommissionRules = async () => {
    return await prisma.commission_rules.findMany({
        where:   { rule_key: { not: "me_min_live_activities" } },
        orderBy: [{ professional_type: "asc" }, { rule_key: "asc" }],
    });
};

exports.getCommissionRuleByKey = async (ruleKey) => {
    return await prisma.commission_rules.findUnique({ where: { rule_key: ruleKey } });
};

exports.updateCommissionRule = async (ruleKey, newValue) => {
    return await prisma.commission_rules.update({
        where: { rule_key: ruleKey },
        data:  { value: newValue, updated_at: new Date() },
    });
};

// ── Commissions ────────────────────────────────────────────────────────────

exports.listCommissions = async ({ professionalType, status, professionalId } = {}) => {
    return await prisma.commissions.findMany({
        where: {
            ...(professionalType && { professional_type: professionalType }),
            ...(status           && { status }),
            ...(professionalId   && { professional_id: Number(professionalId) }),
        },
        include: {
            professionals: {
                select: {
                    id:    true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getCommissionById = async (id) => {
    return await prisma.commissions.findUnique({ where: { id: Number(id) } });
};

exports.approveCommission = async (id) => {
    return await prisma.commissions.update({
        where: { id: Number(id) },
        data:  { status: "approved" },
    });
};

exports.markCommissionPaid = async (id, commissionAmount, professionalId) => {
    await prisma.$transaction(async (tx) => {
        await tx.commissions.update({
            where: { id: Number(id) },
            data:  { status: "paid" },
        });
        // Credit wallet when commission is paid out
        await tx.wallets.upsert({
            where:  { professional_id: professionalId },
            create: { professional_id: professionalId, balance: commissionAmount },
            update: { balance: { increment: commissionAmount }, updated_at: new Date() },
        });
    });
};

// ── Withdrawal requests ────────────────────────────────────────────────────

/**
 * List all professionals who have at least one "requested" commission, with totals.
 */
exports.listWithdrawalRequests = async () => {
    const rows = await prisma.commissions.groupBy({
        by:     ["professional_id"],
        where:  { status: "requested" },
        _sum:   { commission_amount: true },
        _count: { id: true },
    });

    if (rows.length === 0) return [];

    const ids          = rows.map((r) => r.professional_id);
    const professionals = await prisma.professionals.findMany({
        where:  { id: { in: ids } },
        select: {
            id:               true,
            profession_type:  true,
            users:            { select: { full_name: true, mobile: true } },
        },
    });
    const profMap = Object.fromEntries(professionals.map((p) => [p.id, p]));

    return rows.map((r) => ({
        professional_id:   r.professional_id,
        professional:      profMap[r.professional_id] ?? null,
        entry_count:       r._count.id,
        total_amount:      parseFloat(r._sum.commission_amount ?? 0),
    }));
};

/**
 * Mark all "requested" commissions for a professional as "paid" (full withdrawal payout).
 */
exports.markWithdrawalsPaid = async (professionalId) => {
    const requested = await prisma.commissions.findMany({
        where:  { professional_id: Number(professionalId), status: "requested" },
        select: { id: true, commission_amount: true },
    });

    if (requested.length === 0) return { count: 0, total_amount: 0 };

    const ids         = requested.map((c) => c.id);
    const totalAmount = parseFloat(
        requested.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0).toFixed(2)
    );

    await prisma.$transaction(async (tx) => {
        await tx.commissions.updateMany({
            where: { id: { in: ids } },
            data:  { status: "paid" },
        });
    });

    return { count: requested.length, total_amount: totalAmount };
};

// ── Travelling allowances ──────────────────────────────────────────────────

exports.listTravellingAllowances = async ({ trainerProfessionalId, status } = {}) => {
    return await prisma.travelling_allowances.findMany({
        where: {
            ...(trainerProfessionalId && { trainer_professional_id: Number(trainerProfessionalId) }),
            ...(status                && { status }),
        },
        include: {
            professionals: {
                select: {
                    id:    true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { allowance_date: "desc" },
    });
};

exports.getTravellingAllowanceById = async (id) => {
    return await prisma.travelling_allowances.findUnique({ where: { id: Number(id) } });
};

exports.markTravellingAllowancePaid = async (id) => {
    return await prisma.travelling_allowances.update({
        where: { id: Number(id) },
        data:  { status: "paid", updated_at: new Date() },
    });
};

// ── Mark reviewed ──────────────────────────────────────────────────────────

// ── Fee structure upsert ───────────────────────────────────────────────────

exports.getCustomFeeCategories = async (coachingType) => {
    const rows = await prisma.fee_structures.findMany({
        where: {
            coaching_type:    coachingType,
            society_category: "custom",
            custom_category_name: { not: null },
        },
        select: { custom_category_name: true },
        distinct: ["custom_category_name"],
        orderBy: { custom_category_name: "asc" },
    });
    return rows.map((r) => r.custom_category_name);
};

exports.getFeeStructureById = async (id) => {
    return await prisma.fee_structures.findUnique({ where: { id } });
};

exports.updateFeeStructureById = async (id, { total_fee, effective_monthly, custom_category_name, adminUserId }) => {
    return await prisma.fee_structures.update({
        where: { id: Number(id) },
        data: {
            total_fee,
            ...(effective_monthly    !== undefined && { effective_monthly:    effective_monthly ?? null }),
            ...(custom_category_name !== undefined && { custom_category_name: custom_category_name ?? null }),
            last_edited_by: adminUserId,
            last_edited_at: new Date(),
        },
    });
};

exports.createFeeStructure = async (data) => {
    const { activity_id, coaching_type, society_category, custom_category_name, standard, term_months, total_fee, effective_monthly, adminUserId } = data;
    return await prisma.fee_structures.upsert({
        where: {
            activity_id_coaching_type_society_category_custom_category_name_standard_term_months: {
                activity_id:          Number(activity_id),
                coaching_type,
                society_category:     society_category     ?? null,
                custom_category_name: custom_category_name ?? null,
                standard:             standard             ?? null,
                term_months:          Number(term_months),
            },
        },
        create: {
            activity_id:          Number(activity_id),
            coaching_type,
            society_category:     society_category     ?? null,
            custom_category_name: custom_category_name ?? null,
            standard:             standard             ?? null,
            term_months:          Number(term_months),
            total_fee,
            effective_monthly:    effective_monthly ?? null,
            last_edited_by:       adminUserId,
            last_edited_at:       new Date(),
        },
        update: {
            total_fee,
            effective_monthly:    effective_monthly    ?? null,
            custom_category_name: custom_category_name ?? null,
            last_edited_by:       adminUserId,
            last_edited_at:       new Date(),
        },
    });
};

// ── Admin societies ────────────────────────────────────────────────────────

exports.getAllSocietiesAdmin = async () => {
    return await prisma.societies.findMany({
        select: {
            id: true,
            society_unique_id: true,
            society_name: true,
            society_category: true,
            address: true,
            pin_code: true,
            no_of_flats: true,
            total_participants: true,
            proposed_wing: true,
            authority_role: true,
            authority_person_name: true,
            contact_number: true,
            playground_available: true,
            coordinator_name: true,
            coordinator_number: true,
            agreement_signed_by_authority: true,
            approval_status: true,
            created_at: true,
            professionals: {
                select: {
                    id: true,
                    referral_code: true,
                    users: { select: { full_name: true } },
                },
            },
            _count: { select: { individual_participants: true } },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getSocietyAdminById = async (id) => {
    return await prisma.societies.findUnique({
        where: { id },
        select: {
            id: true,
            society_unique_id: true,
            society_name: true,
            society_category: true,
            address: true,
            pin_code: true,
            no_of_flats: true,
            total_participants: true,
            proposed_wing: true,
            authority_role: true,
            authority_person_name: true,
            contact_number: true,
            playground_available: true,
            coordinator_name: true,
            coordinator_number: true,
            agreement_signed_by_authority: true,
            activity_agreement_pdf: true,
            approval_status: true,
            created_at: true,
            professionals: {
                select: {
                    id: true,
                    referral_code: true,
                    users: { select: { full_name: true } },
                },
            },
            individual_participants: {
                select: {
                    id: true,
                    activity: true,
                    flat_no: true,
                    dob: true,
                    age: true,
                    kits: true,
                    students: {
                        select: {
                            users: { select: { full_name: true, mobile: true } },
                        },
                    },
                },
                orderBy: { id: "desc" },
            },
        },
    });
};

exports.adminInsertSociety = async (data, meProfessionalId, adminUserId) => {
    const society = await prisma.societies.create({
        data: {
            society_unique_id: data.societyUniqueId,
            registered_by_user_id: adminUserId,
            me_professional_id: meProfessionalId ?? null,
            society_name: data.societyName,
            society_category: data.societyCategory === "A+" ? "A_" : (data.societyCategory ?? null),
            address: data.address,
            pin_code: data.pinCode,
            total_participants: data.totalParticipants ? Number(data.totalParticipants) : null,
            no_of_flats: data.noOfFlats ? Number(data.noOfFlats) : null,
            proposed_wing: data.proposedWing || null,
            authority_role: data.authorityRole || null,
            authority_person_name: data.authorityPersonName || null,
            contact_number: data.contactNumber || null,
            playground_available: data.playgroundAvailable ? true : false,
            coordinator_name: data.coordinatorName || null,
            coordinator_number: data.coordinatorNumber || null,
            agreement_signed_by_authority: data.agreementSignedByAuthority ? true : false,
            activity_agreement_pdf: data.activityAgreementPdf || null,
            approval_status: "approved",
        },
    });
    return society.id;
};

// ── Admin schools ──────────────────────────────────────────────────────────

exports.getAllSchoolsAdmin = async () => {
    return await prisma.schools.findMany({
        select: {
            id: true,
            school_name: true,
            address: true,
            pin_code: true,
            state: true,
            language_medium: true,
            landline_no: true,
            principal_name: true,
            principal_contact: true,
            activity_coordinator: true,
            agreement_signed_by_authority: true,
            activity_agreement_pdf: true,
            approval_status: true,
            created_at: true,
            professionals: {
                select: {
                    id: true,
                    referral_code: true,
                    users: { select: { full_name: true } },
                },
            },
            _count: { select: { school_students: true } },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getSchoolAdminById = async (id) => {
    return await prisma.schools.findUnique({
        where: { id },
        select: {
            id: true,
            school_name: true,
            address: true,
            pin_code: true,
            state: true,
            language_medium: true,
            landline_no: true,
            principal_name: true,
            principal_contact: true,
            activity_coordinator: true,
            agreement_signed_by_authority: true,
            activity_agreement_pdf: true,
            approval_status: true,
            created_at: true,
            professionals: {
                select: {
                    id: true,
                    referral_code: true,
                    users: { select: { full_name: true } },
                },
            },
            school_students: {
                select: {
                    id: true,
                    student_name: true,
                    standard: true,
                    address: true,
                    activities: true,
                    kit_type: true,
                    students: {
                        select: {
                            users: { select: { full_name: true, mobile: true } },
                        },
                    },
                },
                orderBy: { id: "desc" },
            },
        },
    });
};

exports.adminInsertSchool = async (data, meProfessionalId) => {
    const school = await prisma.schools.create({
        data: {
            me_professional_id: meProfessionalId ?? null,
            school_name: data.schoolName,
            address: data.address,
            pin_code: data.pinCode,
            state: data.state,
            language_medium: data.languageMedium || null,
            landline_no: data.landlineNo || null,
            principal_name: data.principalName,
            principal_contact: data.principalContact,
            activity_coordinator: data.activityCoordinator || null,
            agreement_signed_by_authority: data.agreementSignedByAuthority ? true : false,
            activity_agreement_pdf: data.activityAgreementPdf || null,
            approval_status: "approved",
        },
    });
    return school.id;
};

// ── Trainer assignments ────────────────────────────────────────────────────

exports.listTrainerAssignments = async ({ professionalId, isActive } = {}) => {
    return await prisma.trainer_assignments.findMany({
        where: {
            ...(professionalId !== undefined && { professional_id: Number(professionalId) }),
            ...(isActive       !== undefined && { is_active: isActive }),
        },
        include: {
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
            societies:     { select: { id: true, society_name: true } },
            schools:       { select: { id: true, school_name: true } },
            activities:    { select: { id: true, name: true } },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.updateAssignmentSessionsCap = async (assignmentId, sessionsAllocated) => {
    return await prisma.trainer_assignments.update({
        where: { id: Number(assignmentId) },
        data:  { sessions_allocated: Number(sessionsAllocated) },
    });
};

exports.deactivateAssignment = async (assignmentId) => {
    return await prisma.trainer_assignments.update({
        where: { id: Number(assignmentId) },
        data:  { is_active: false },
    });
};

// ── Unsettled assignments alert count ─────────────────────────────────────

exports.countUnsettledAssignments = async (daysThreshold = 30) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);
    return await prisma.trainer_assignments.count({
        where: {
            is_active: true,
            OR: [
                { last_settled_at: null,  assigned_from: { lte: cutoff } },
                { last_settled_at: { lte: cutoff } },
            ],
        },
    });
};

// ── ME lookup helpers ──────────────────────────────────────────────────────

exports.findMEByReferralCode = async (referralCode) => {
    return await prisma.professionals.findFirst({
        where: { referral_code: referralCode, profession_type: "marketing_executive" },
        select: { id: true, referral_code: true },
    });
};

exports.getAllMEList = async () => {
    return await prisma.professionals.findMany({
        where: {
            profession_type: "marketing_executive",
            users: { approval_status: "approved" },
        },
        select: {
            id: true,
            referral_code: true,
            users: { select: { full_name: true } },
        },
        orderBy: { id: "asc" },
    });
};

// ── Admin school_students list ─────────────────────────────────────────────

exports.getAllSchoolStudents = async () => {
    return await prisma.school_students.findMany({
        select: {
            id: true,
            student_name: true,
            standard: true,
            activities: true,
            kit_type: true,
            created_at: true,
            schools: { select: { id: true, school_name: true } },
            students: {
                select: {
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

// ── Admin group coaching (individual_participants) full list ───────────────

exports.getAllGroupCoachingStudents = async () => {
    return await prisma.individual_participants.findMany({
        select: {
            id: true,
            activity: true,
            flat_no: true,
            dob: true,
            age: true,
            kits: true,
            society_id: true,
            society_name: true,
            societies: { select: { id: true, society_name: true } },
            students: {
                select: {
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });
};

// ── Payments list ─────────────────────────────────────────────────────────

exports.listPayments = async ({ serviceType, status, userId, from, to } = {}) => {
    return await prisma.payments.findMany({
        where: {
            ...(serviceType && { service_type: serviceType }),
            ...(status      && { status }),
            ...(userId      && { student_user_id: Number(userId) }),
            ...((from || to) ? {
                captured_at: {
                    ...(from && { gte: new Date(from) }),
                    ...(to   && { lte: new Date(to) }),
                },
            } : {}),
        },
        select: {
            id: true,
            razorpay_order_id: true,
            razorpay_payment_id: true,
            service_type: true,
            amount: true,
            currency: true,
            term_months: true,
            status: true,
            captured_at: true,
            student_user_id: true,
            users: { select: { id: true, full_name: true, mobile: true } },
        },
        orderBy: { captured_at: "desc" },
    });
};

// ── Sessions list ──────────────────────────────────────────────────────────

exports.listSessions = async ({ type, from, to, professionalId, status } = {}) => {
    const typeMap = {
        personal_tutor:      "personal_tutor",
        individual_coaching: "individual_coaching",
        group_coaching:      "group_coaching",
        school:              "school",
    };
    return await prisma.sessions.findMany({
        where: {
            ...(type         && { session_type: typeMap[type] }),
            ...(status       && { status }),
            ...(professionalId && { professional_id: Number(professionalId) }),
            ...(from || to   ? {
                scheduled_date: {
                    ...(from && { gte: new Date(from) }),
                    ...(to   && { lte: new Date(to) }),
                },
            } : {}),
        },
        select: {
            id: true,
            session_type: true,
            scheduled_date: true,
            start_time: true,
            end_time: true,
            status: true,
            batch_id: true,
            student_id: true,
            professional_id: true,
            activity_id: true,
            batches: { select: { id: true, batch_name: true } },
            students: { select: { id: true, users: { select: { full_name: true } } } },
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true } } } },
            activities: { select: { id: true, name: true } },
        },
        orderBy: { scheduled_date: "desc" },
    });
};

exports.createSession = async (data) => {
    return await prisma.sessions.create({ data });
};

// Returns the personal_tutor or individual_participant record with full student details
exports.getPersonalTutorForSession = async (id) => {
    return await prisma.personal_tutors.findUnique({
        where: { id: Number(id) },
        select: {
            id: true,
            standard: true,
            batch: true,
            teacher_for: true,
            dob: true,
            teacher_professional_id: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true, address: true } },
                },
            },
        },
    });
};

exports.getIndividualParticipantForSession = async (id) => {
    return await prisma.individual_participants.findUnique({
        where: { id: Number(id) },
        select: {
            id: true,
            activity: true,
            flat_no: true,
            society_name: true,
            dob: true,
            age: true,
            trainer_professional_id: true,
            societies: { select: { id: true, society_name: true, address: true } },
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true, address: true } },
                },
            },
        },
    });
};

// Professionals for session creation with busy/available at the given slot
exports.getProfessionalsForSession = async (professionType, { date, startTime, endTime, subject, activity } = {}) => {
    const parseTime = (t) => {
        if (!t) return undefined;
        const [h, m, s = "0"] = String(t).split(":");
        return new Date(1970, 0, 1, Number(h), Number(m), Number(s));
    };
    const st = parseTime(startTime);
    const et = parseTime(endTime);

    let busyIds = new Set();
    if (date && st && et) {
        const conflicts = await prisma.sessions.findMany({
            where: {
                scheduled_date: new Date(date),
                status: { notIn: ["cancelled"] },
                AND: [{ start_time: { lt: et } }, { end_time: { gt: st } }],
                professionals: { profession_type: professionType },
            },
            select: { professional_id: true },
            distinct: ["professional_id"],
        });
        busyIds = new Set(conflicts.map((r) => r.professional_id));
    }

    const whereDetails = professionType === "teacher"
        ? { teachers: subject ? { some: { subject: { contains: subject } } } : { some: {} } }
        : { trainers: activity ? { some: { specified_game: { contains: activity } } } : { some: {} } };

    const rows = await prisma.professionals.findMany({
        where: {
            profession_type: professionType,
            users: { approval_status: "approved" },
            ...whereDetails,
        },
        select: {
            id: true,
            place: true,
            users: { select: { full_name: true, mobile: true, address: true } },
            teachers: { select: { subject: true, experience_details: true } },
            trainers: { select: { category: true, specified_game: true, experience_details: true } },
        },
    });

    return rows.map((r) => ({ ...r, is_available: !busyIds.has(r.id) }));
};

// ── Batches per society or school ──────────────────────────────────────────

exports.getBatchesBySociety = async (societyId) => {
    return await prisma.batches.findMany({
        where: { society_id: Number(societyId) },
        select: {
            id: true,
            batch_type: true,
            batch_name: true,
            days_of_week: true,
            start_time: true,
            end_time: true,
            start_date: true,
            end_date: true,
            is_active: true,
            activities: { select: { id: true, name: true } },
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true } } } },
            _count: { select: { batch_students: true } },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getBatchesBySchool = async (schoolId) => {
    return await prisma.batches.findMany({
        where: { school_id: Number(schoolId) },
        select: {
            id: true,
            batch_type: true,
            batch_name: true,
            days_of_week: true,
            start_time: true,
            end_time: true,
            start_date: true,
            end_date: true,
            is_active: true,
            activities: { select: { id: true, name: true } },
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true } } } },
            _count: { select: { batch_students: true } },
        },
        orderBy: { created_at: "desc" },
    });
};

// tx is a Prisma transaction client when called inside $transaction,
// or null when called outside (rejection path) — falls back to prisma directly.
exports.markReviewed = async (tx, id, status, reviewedBy, note) => {
    const client = tx ?? prisma;
    await client.pending_registrations.update({
        where: { id: Number(id) },
        data: {
            status,
            reviewed_by: reviewedBy,
            review_note: note ?? null,
            reviewed_at: new Date(),
        },
    });
};
