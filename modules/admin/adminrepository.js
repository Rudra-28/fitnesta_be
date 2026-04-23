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

// ── Single professional by ID ─────────────────────────────────────────────

exports.getProfessionalById = async (professionalId) => {
    return await prisma.professionals.findUnique({
        where: { id: Number(professionalId) },
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
            membership_start_date: true,
            membership_end_date: true,
            term_months: true,
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
        where: { students: { student_type: "individual_coaching" } },
        select: {
            id: true,
            activity: true,
            flat_no: true,
            society_name: true,
            dob: true,
            age: true,
            kits: true,
            membership_start_date: true,
            membership_end_date: true,
            term_months: true,
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
            ...(coachingType ? { fee_structures: { some: { coaching_type: coachingType } } } : {}),
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

// adminRepo.js
exports.getApprovedSocieties = async () => {
    return await prisma.societies.findMany({
        where: { approval_status: "approved" },
        select: { 
            id: true, 
            society_name: true, 
            society_category: true, 
            custom_category_name: true, 
            address: true,
            _count: {
                select: { participants: true } 
            }
        },
        orderBy: { society_name: "asc" },
    });
};

// adminRepo.js
exports.getSocietyById = async (id) => {
    return await prisma.societies.findUnique({
        where: { id: parseInt(id) },
        include: {
            // This 'participants' key must match your Prisma schema relation name
            participants: {
                select: {
                    id: true,
                    full_name: true,
                    email: true,
                    phone: true,
                    activity_name: true, // Assuming participants have an activity field
                    status: true
                }
            }
        }
    });
};
// New function for fetching details when clicked
exports.getSocietyParticipants = async (societyId) => {
    return await prisma.societies.findUnique({
        where: { id: parseInt(societyId) },
        select: {
            society_name: true,
            participants: {
                select: {
                    id: true,
                    full_name: true,
                    activity_name: true, 
                    email: true
                }
            }
        }
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

exports.findPersonalTutorByStudentId = async (studentId) => {
    return await prisma.personal_tutors.findFirst({
        where: { student_id: Number(studentId) },
        select: { id: true, teacher_professional_id: true },
    });
};

exports.findIndividualParticipantById = async (id) => {
    return await prisma.individual_participants.findUnique({ where: { id } });
};

exports.findIndividualParticipantByStudentId = async (studentId) => {
    return await prisma.individual_participants.findFirst({
        where: { student_id: Number(studentId) },
        select: { id: true, trainer_professional_id: true },
    });
};

exports.findProfessionalById = async (id, type) => {
    return await prisma.professionals.findFirst({
        where: { id, profession_type: type },
        select: { id: true, profession_type: true },
    });
};

// Only these service types require admin approval
const APPROVABLE_SERVICE_TYPES = ["trainer", "teacher", "marketing_executive", "vendor", "society_request"];

exports.getAllPending = async (serviceType) => {
    return await prisma.pending_registrations.findMany({
        where: {
            status: "pending",
            service_type: serviceType
                ? serviceType
                : { in: APPROVABLE_SERVICE_TYPES },
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

// ── Admin Profit Stats ─────────────────────────────────────────────────────

/**
 * Aggregate commission rows to compute admin's profit share.
 *
 * For every commission row:
 *   base_amount       = the monthly fee collected from students (what Fitnesta earned on those sessions)
 *   commission_amount = what the professional (trainer / teacher / ME) earned
 *   admin_share       = base_amount - commission_amount  (admin's profit margin)
 *
 * Results are grouped by status (on_hold | pending | approved | paid)
 * and by professional_type so the dashboard can show a breakdown.
 *
 * @param {{ from?: string, to?: string }} opts  — optional date range filter (ISO date strings)
 */
exports.getAdminProfitStats = async ({ from, to } = {}) => {
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to)   dateFilter.lte = new Date(to);

    const where = Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {};

    // Aggregate sums grouped by status + professional_type
    const grouped = await prisma.commissions.groupBy({
        by:    ["status", "professional_type"],
        where,
        _sum:  {
            base_amount:       true,
            commission_amount: true,
        },
        _count: { id: true },
    });

    // Also pull total captured payments for the same period (gross revenue)
    const paymentsWhere = Object.keys(dateFilter).length > 0
        ? { status: "captured", captured_at: dateFilter }
        : { status: "captured" };

    const paymentAgg = await prisma.payments.aggregate({
        where: paymentsWhere,
        _sum:  { amount: true },
        _count: { id: true },
    });

    // RE-summarise into a clean shape
    const byStatus = { on_hold: {}, pending: {}, approved: {}, paid: {} };

    for (const row of grouped) {
        const s   = row.status;
        const pt  = row.professional_type;
        const base = parseFloat(row._sum.base_amount       ?? 0);
        const comm = parseFloat(row._sum.commission_amount ?? 0);

        if (!byStatus[s]) byStatus[s] = {};
        if (!byStatus[s][pt]) byStatus[s][pt] = { base_amount: 0, commission_amount: 0, admin_share: 0, count: 0 };

        byStatus[s][pt].base_amount       += base;
        byStatus[s][pt].commission_amount += comm;
        byStatus[s][pt].admin_share       += (base - comm);
        byStatus[s][pt].count             += row._count.id;
    }

    // Flatten into per-status totals + per-type breakdown
    const summary = {};
    for (const [status, byType] of Object.entries(byStatus)) {
        const totalBase  = Object.values(byType).reduce((s, v) => s + v.base_amount,       0);
        const totalComm  = Object.values(byType).reduce((s, v) => s + v.commission_amount,  0);
        const totalAdmin = Object.values(byType).reduce((s, v) => s + v.admin_share,        0);
        const totalCount = Object.values(byType).reduce((s, v) => s + v.count,              0);

        summary[status] = {
            total_base_amount:       parseFloat(totalBase.toFixed(2)),
            total_commission_amount: parseFloat(totalComm.toFixed(2)),
            admin_profit:            parseFloat(totalAdmin.toFixed(2)),
            commission_count:        totalCount,
            by_professional_type:    Object.fromEntries(
                Object.entries(byType).map(([pt, v]) => [pt, {
                    base_amount:       parseFloat(v.base_amount.toFixed(2)),
                    commission_amount: parseFloat(v.commission_amount.toFixed(2)),
                    admin_share:       parseFloat(v.admin_share.toFixed(2)),
                    count:             v.count,
                }])
            ),
        };
    }

    const grandBase  = grouped.reduce((s, r) => s + parseFloat(r._sum.base_amount       ?? 0), 0);
    const grandComm  = grouped.reduce((s, r) => s + parseFloat(r._sum.commission_amount ?? 0), 0);

    return {
        gross_revenue:           parseFloat((paymentAgg._sum.amount ?? 0).toFixed(2)),
        total_payment_count:     paymentAgg._count.id,
        total_base_amount:       parseFloat(grandBase.toFixed(2)),
        total_commission_paid_out: parseFloat(grandComm.toFixed(2)),
        total_admin_profit:      parseFloat((grandBase - grandComm).toFixed(2)),
        // Profit realised only from PAID commissions (most conservative view)
        realised_profit: parseFloat(
            Object.values(byStatus.paid ?? {}).reduce((s, v) => s + v.admin_share, 0).toFixed(2)
        ),
        by_status: summary,
    };
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
    // Names already in fee_structures
    const feeRows = await prisma.fee_structures.findMany({
        where: {
            coaching_type:        coachingType,
            society_category:     "custom",
            custom_category_name: { not: null },
        },
        select:   { custom_category_name: true },
        distinct: ["custom_category_name"],
    });

    // Names from societies registered by ME (may not have fees yet)
    // Only relevant for group_coaching societies — school custom categories
    // come from school fee structures only, not society rows.
    const societyRows = coachingType === "group_coaching"
        ? await prisma.societies.findMany({
              where:    { society_category: "custom", custom_category_name: { not: null } },
              select:   { custom_category_name: true },
              distinct: ["custom_category_name"],
          })
        : [];

    const merged = [
        ...feeRows.map((r) => r.custom_category_name),
        ...societyRows.map((r) => r.custom_category_name),
    ];
    return [...new Set(merged)].sort();
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

exports.deleteFeeStructureById = async (id) => {
    return await prisma.fee_structures.delete({ where: { id } });
};

exports.createFeeStructure = async (data) => {
    const { activity_id, coaching_type, society_category, custom_category_name, standard, term_months, total_fee, effective_monthly, adminUserId } = data;
    // Prisma requires non-null values in composite unique keys — use "" as sentinel for "no standard"
    const standardKey = standard ?? '';
    return await prisma.fee_structures.upsert({
        where: {
            activity_id_coaching_type_society_category_custom_category_name_standard_term_months: {
                activity_id:          Number(activity_id),
                coaching_type,
                society_category:     society_category     ?? null,
                custom_category_name: custom_category_name ?? null,
                standard:             standardKey,
                term_months:          Number(term_months),
            },
        },
        create: {
            activity_id:          Number(activity_id),
            coaching_type,
            society_category:     society_category     ?? null,
            custom_category_name: custom_category_name ?? null,
            standard:             standardKey || null,
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

// ── Activity CRUD ─────────────────────────────────────────────────────────

/**
 * Create an activity and optionally insert fee rows in one transaction.
 * @param {object}   activityData  - { name, notes, activity_category, image_url }
 * @param {object[]} fees          - array of fee rows (may be empty)
 * @param {number}   adminUserId
 */
exports.createActivityWithFees = async (activityData, fees = [], adminUserId = null) => {
    return await prisma.$transaction(async (tx) => {
        const activity = await tx.activities.create({
            data: {
                name:              activityData.name,
                notes:             activityData.notes             ?? null,
                activity_category: activityData.activity_category,
                image_url:         activityData.image_url         ?? null,
            },
        });

        for (const f of fees) {
            const societyCategory = f.society_category === "A+" ? "A_" : (f.society_category ?? null);
            const standardKey     = f.standard ?? "";
            await tx.fee_structures.upsert({
                where: {
                    activity_id_coaching_type_society_category_custom_category_name_standard_term_months: {
                        activity_id:          activity.id,
                        coaching_type:        f.coaching_type,
                        society_category:     societyCategory     ?? null,
                        custom_category_name: f.custom_category_name ?? null,
                        standard:             standardKey,
                        term_months:          Number(f.term_months),
                    },
                },
                create: {
                    activity_id:          activity.id,
                    coaching_type:        f.coaching_type,
                    society_category:     societyCategory         ?? null,
                    custom_category_name: f.custom_category_name  ?? null,
                    standard:             standardKey || null,
                    term_months:          Number(f.term_months),
                    total_fee:            f.total_fee,
                    effective_monthly:    f.effective_monthly      ?? null,
                    last_edited_by:       adminUserId,
                    last_edited_at:       new Date(),
                },
                update: {
                    total_fee:            f.total_fee,
                    effective_monthly:    f.effective_monthly      ?? null,
                    last_edited_by:       adminUserId,
                    last_edited_at:       new Date(),
                },
            });
        }

        return activity;
    });
};

exports.createActivity = async ({ name, notes, activity_category, image_url }) => {
    return await prisma.activities.create({
        data: { name, notes: notes ?? null, activity_category, image_url: image_url ?? null },
    });
};

exports.updateActivity = async (id, { name, notes, activity_category, image_url, is_active }) => {
    return await prisma.activities.update({
        where: { id },
        data: {
            ...(name              !== undefined && { name }),
            ...(notes             !== undefined && { notes: notes ?? null }),
            ...(activity_category !== undefined && { activity_category }),
            ...(image_url         !== undefined && { image_url: image_url ?? null }),
            ...(is_active         !== undefined && { is_active }),
        },
    });
};

exports.getActivityById = async (id) => {
    return await prisma.activities.findUnique({
        where: { id },
        select: { id: true, name: true, notes: true, activity_category: true, image_url: true, is_active: true },
    });
};

exports.activityHasHistory = async (id) => {
    const [fees, batches, sessions] = await Promise.all([
        prisma.fee_structures.count({ where: { activity_id: id } }),
        prisma.batches.count({ where: { activity_id: id } }),
        prisma.sessions.count({ where: { activity_id: id } }),
    ]);
    return fees + batches + sessions > 0;
};

exports.hardDeleteActivity = async (id) => {
    return await prisma.activities.delete({ where: { id } });
};

// ── Admin societies ────────────────────────────────────────────────────────

exports.getAllSocietiesAdmin = async () => {
    return await prisma.societies.findMany({
        select: {
            id: true,
            society_unique_id: true,
            society_name: true,
            society_category: true,
            custom_category_name: true,
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
            custom_category_name: true,
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
            society_category:     data.societyCategory === "A+" ? "A_" : (data.societyCategory ?? null),
            custom_category_name: data.societyCategory === "custom" ? (data.customCategoryName?.trim() ?? null) : null,
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

exports.getActivitiesByIds = async (ids) => {
    if (!ids.length) return [];
    return await prisma.activities.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
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
        where: { students: { student_type: "group_coaching" } },
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

/**
 * Returns students eligible to be added to a specific group_coaching batch.
 * Filters by society_id + activity name (derived from activity_id) and student_type = group_coaching.
 * Excludes students already in the batch.
 */
exports.getGroupCoachingStudentsForBatch = async (batchId, societyId, activityId) => {
    // Resolve activity name from id
    const activity = activityId
        ? await prisma.activities.findUnique({ where: { id: Number(activityId) }, select: { name: true } })
        : null;

    // Students already in this batch — exclude them
    const alreadyIn = await prisma.batch_students.findMany({
        where: { batch_id: Number(batchId) },
        select: { student_id: true },
    });
    const excludeIds = alreadyIn.map(r => r.student_id);

    return prisma.individual_participants.findMany({
        where: {
            ...(societyId  && { society_id: Number(societyId) }),
            ...(activity   && { activity: activity.name }),
            students: {
                student_type: "group_coaching",
                ...(excludeIds.length > 0 && { id: { notIn: excludeIds } }),
            },
        },
        select: {
            id: true,
            activity: true,
            society_id: true,
            society_name: true,
            batch_id: true,
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

/**
 * Returns students eligible to be added to a specific school_student batch.
 * Filters by school_id + activity_id (activity_ids is a JSON array on school_students).
 * Excludes students already in the batch.
 */
exports.getSchoolStudentsForBatch = async (batchId, schoolId, activityId) => {
    // Students already in this batch — exclude them
    const alreadyIn = await prisma.batch_students.findMany({
        where: { batch_id: Number(batchId) },
        select: { student_id: true },
    });
    const excludeIds = alreadyIn.map(r => r.student_id);

    const where = {
        school_id: Number(schoolId),
        students: {
            student_type: "school_student",
            ...(excludeIds.length > 0 && { id: { notIn: excludeIds } }),
        },
    };

    const rows = await prisma.school_students.findMany({
        where,
        select: {
            id:           true,
            student_name: true,
            standard:     true,
            activities:   true,
            school_id:    true,
            students: {
                select: {
                    id:    true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { id: "desc" },
    });

    // Filter by activityId if provided (activities is stored as JSON array of ids)
    if (activityId) {
        const actId = Number(activityId);
        return rows.filter(r => {
            try {
                const ids = typeof r.activities === "string"
                    ? JSON.parse(r.activities)
                    : (r.activities || []);
                return ids.map(Number).includes(actId);
            } catch { return false; }
        });
    }

    return rows;
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

// ── Pay-ins ────────────────────────────────────────────────────────────────

exports.listPayIns = async ({ serviceType, from, to } = {}) => {
    return await prisma.payments.findMany({
        where: {
            status: "captured",
            ...(serviceType && { service_type: serviceType }),
            ...((from || to) ? { captured_at: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
        },
        select: {
            id: true,
            razorpay_payment_id: true,
            service_type: true,
            amount: true,
            currency: true,
            term_months: true,
            captured_at: true,
            users: { select: { id: true, full_name: true, mobile: true } },
        },
        orderBy: { captured_at: "desc" },
    });
};

// ── Pay-outs ───────────────────────────────────────────────────────────────

exports.listPayOutCommissions = async ({ professionalType, status, from, to } = {}) => {

    const whereClause = {
        ...(professionalType && { professional_type: professionalType }),
        ...((from || to) ? { created_at: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
    };

    if (status) {
        whereClause.status = status;
    } else {
        // If the admin is just looking at the general payout list, 
        // exclude anything that hasn't been settled yet.
        whereClause.status = { not: "on_hold" };
    }

    return await prisma.commissions.findMany({
        where: whereClause,
        select: {
            id: true,
            professional_type: true,
            source_type: true,
            source_id: true,
            commission_amount: true,
            status: true,
            created_at: true,
            professionals: { select: { id: true, users: { select: { full_name: true, mobile: true } } } },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.listPayOutRefunds = async ({ status, from, to } = {}) => {
    return await prisma.kit_order_refunds.findMany({
        where: {
            ...(status && { status }),
            ...((from || to) ? { created_at: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
        },
        select: {
            id: true,
            kit_order_id: true,
            amount: true,
            reason: true,
            status: true,
            created_at: true,
            users: { select: { id: true, full_name: true, mobile: true } },
            kit_orders: { select: { razorpay_payment_id: true, vendor_products: { select: { product_name: true } } } },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.getRefundById = async (id) => {
    return await prisma.kit_order_refunds.findUnique({ where: { id: Number(id) } });
};

exports.markRefundProcessed = async (refundId) => {
    return await prisma.kit_order_refunds.update({
        where: { id: Number(refundId) },
        data:  { status: "processed" },
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
            preferred_time: true,
            teacher_professional_id: true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true, address: true } },
                    parent_consents: {
                        select: { parent_name: true, emergency_contact_no: true },
                        orderBy: { created_at: 'desc' },
                        take: 1,
                    },
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
            preferred_batch: true,
            preferred_time: true,
            trainer_professional_id: true,
            societies: { select: { id: true, society_name: true, address: true } },
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true, address: true } },
                    parent_consents: {
                        select: { parent_name: true, emergency_contact_no: true },
                        orderBy: { created_at: 'desc' },
                        take: 1,
                    },
                },
            },
        },
    });
};

// Professionals for session creation with busy/available at the given slot
exports.getProfessionalsForSession = async (professionType, { date, startTime, endTime, subject, activityId } = {}) => {
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

    const baseWhere = { profession_type: professionType, users: { approval_status: "approved" } };

    let rows = [];
    if (professionType === "teacher") {
        // Try filtered by subject first; fall back to all teachers if none match
        if (subject) {
            rows = await prisma.professionals.findMany({
                where: { ...baseWhere, teachers: { some: { subject: { contains: subject } } } },
                select: {
                    id: true, place: true,
                    users: { select: { full_name: true, mobile: true, address: true } },
                    teachers: { select: { subject: true, experience_details: true } },
                },
            });
        }
        if (!rows.length) {
            // No teacher matched the specific subject — return all approved teachers
            rows = await prisma.professionals.findMany({
                where: { ...baseWhere, teachers: { some: {} } },
                select: {
                    id: true, place: true,
                    users: { select: { full_name: true, mobile: true, address: true } },
                    teachers: { select: { subject: true, experience_details: true } },
                },
            });
        }
    } else {
        // Filter by specified_game JSON array (stores activity IDs) when activityId is provided
        const trainerWhere = activityId
            ? { ...baseWhere, trainers: { some: { specified_game: { array_contains: Number(activityId) } } } }
            : { ...baseWhere, trainers: { some: {} } };
        rows = await prisma.professionals.findMany({
            where: trainerWhere,
            select: {
                id: true, place: true,
                users: { select: { full_name: true, mobile: true, address: true } },
                trainers: { select: { category: true, specified_game: true, experience_details: true } },
            },
        });
    }

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

// ── Audit logs ────────────────────────────────────────────────────────────

exports.getAuditLogs = async ({ adminUserId, action, from, to, limit, offset }) => {
    const where = {};
    if (adminUserId) where.admin_user_id = Number(adminUserId);
    if (action)      where.action        = action;
    if (from || to) {
        where.performed_at = {};
        if (from) where.performed_at.gte = new Date(from);
        if (to)   where.performed_at.lte = new Date(to);
    }

    const [rows, total] = await Promise.all([
        prisma.audit_logs.findMany({
            where,
            orderBy: { performed_at: "desc" },
            take:  limit  ? Number(limit)  : 50,
            skip:  offset ? Number(offset) : 0,
        }),
        prisma.audit_logs.count({ where }),
    ]);

    return { total, rows };
};

// ── Sub-admin management ───────────────────────────────────────────────────

exports.findUserByMobile = async (mobile) => {
    return prisma.users.findFirst({ where: { mobile } });
};

exports.createSubAdmin = async ({ full_name, mobile, email }) => {
    return prisma.$transaction(async (tx) => {
        const user = await tx.users.create({
            data: {
                uuid:            require("crypto").randomUUID(),
                role:            "admin",
                full_name,
                mobile,
                email:           email ?? null,
                is_verified:     true,
                approval_status: "approved",
            },
        });
        const adminRow = await tx.admins.create({
            data: { user_id: user.id, scope: "sub_admin" },
        });
        return { user, adminRow };
    });
};

exports.listAdmins = async () => {
    return prisma.admins.findMany({
        select: {
            id:         true,
            scope:      true,
            created_at: true,
            users: {
                select: {
                    id:        true,
                    full_name: true,
                    mobile:    true,
                    email:     true,
                },
            },
        },
        orderBy: [{ scope: "asc" }, { created_at: "asc" }],
    });
};

exports.findAdminByUserId = async (userId) => {
    return prisma.admins.findFirst({ where: { user_id: Number(userId) } });
};

exports.removeSubAdmin = async (userId) => {
    return prisma.$transaction(async (tx) => {
        await tx.admins.deleteMany({ where: { user_id: Number(userId) } });
        await tx.users.update({
            where: { id: Number(userId) },
            data:  { role: "removed" },
        });
    });
};

// ── User management (super_admin) ─────────────────────────────────────────

exports.listUsers = async ({ role, subrole, search, limit = 50, offset = 0 }) => {
    const where = { role: { not: "removed" } };
    if (role)    where.role    = role;
    if (subrole) where.subrole = subrole;
    if (search) {
        where.OR = [
            { full_name: { contains: search } },
            { mobile:    { contains: search } },
            { email:     { contains: search } },
        ];
    }
    const [rows, total] = await Promise.all([
        prisma.users.findMany({
            where,
            select: {
                id:              true,
                uuid:            true,
                role:            true,
                subrole:         true,
                full_name:       true,
                mobile:          true,
                email:           true,
                address:         true,
                photo:           true,
                created_at:      true,
                is_verified:     true,
                approval_status: true,
                is_suspended:    true,
                suspended_at:    true,
                suspension_note: true,
            },
            orderBy: { created_at: "desc" },
            take:    Number(limit),
            skip:    Number(offset),
        }),
        prisma.users.count({ where }),
    ]);
    return { rows, total };
};

exports.getUserById = async (userId) => {
    return prisma.users.findUnique({
        where:  { id: Number(userId) },
        select: {
            id:              true,
            uuid:            true,
            role:            true,
            subrole:         true,
            full_name:       true,
            mobile:          true,
            email:           true,
            address:         true,
            photo:           true,
            created_at:      true,
            is_verified:     true,
            approval_status: true,
            is_suspended:    true,
            suspended_at:    true,
            suspension_note: true,
        },
    });
};

exports.updateUser = async (userId, data) => {
    return prisma.users.update({
        where: { id: Number(userId) },
        data,
    });
};

exports.suspendUser = async (userId, adminId, note) => {
    return prisma.users.update({
        where: { id: Number(userId) },
        data: {
            is_suspended:    true,
            suspended_at:    new Date(),
            suspended_by:    adminId,
            suspension_note: note ?? null,
        },
    });
};

exports.unsuspendUser = async (userId) => {
    return prisma.users.update({
        where: { id: Number(userId) },
        data: {
            is_suspended:    false,
            suspended_at:    null,
            suspended_by:    null,
            suspension_note: null,
        },
    });
};

// ── Visiting Forms ────────────────────────────────────────────────────────────

exports.getAllVisitingForms = async ({ meId, placeType, permissionStatus, from, to, page, limit }) => {
    const where = {};

    if (meId)             where.me_professional_id = Number(meId);
    if (placeType)        where.place_type         = placeType;
    if (permissionStatus) where.permission_status  = permissionStatus;
    if (from || to) {
        where.visit_date = {};
        if (from) where.visit_date.gte = new Date(from);
        if (to)   where.visit_date.lte = new Date(to);
    }

    const skip  = (page - 1) * limit;
    const [total, rows] = await Promise.all([
        prisma.visiting_forms.count({ where }),
        prisma.visiting_forms.findMany({
            where,
            orderBy: { visit_date: "desc" },
            skip,
            take: limit,
            include: {
                professionals: {
                    select: {
                        id:      true,
                        user_id: true,
                        users:   { select: { id: true, full_name: true, mobile: true, email: true, photo: true } },
                    },
                },
            },
        }),
    ]);

    return { total, rows };
};

exports.getVisitingFormByIdAdmin = async (formId) => {
    return await prisma.visiting_forms.findFirst({
        where: { id: formId },
        include: {
            professionals: {
                select: {
                    id:      true,
                    user_id: true,
                    users:   { select: { id: true, full_name: true, mobile: true, email: true, photo: true } },
                },
            },
        },
    });
};

// ── Trainer/Teacher enriched settlement preview ───────────────────────────

/**
 * For each assignment, return extra session counts:
 *   upcoming_sessions, absent_sessions, attendance_pct
 * as well as batch details for group coaching.
 */
exports.getAssignmentSessionExtras = async (assignment) => {
    const now = new Date();
    const {
        id, professional_id, assignment_type,
        society_id, school_id, activity_id,
        assigned_from, last_settled_at,
    } = assignment;

    const windowStart = last_settled_at ? new Date(last_settled_at) : new Date(assigned_from);

    // Cycle end = windowStart + 1 month. Sessions beyond this belong to the next cycle.
    const cycleEnd = new Date(windowStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);

    const sessionType =
        assignment_type === "individual_coaching" ? "individual_coaching" :
        assignment_type === "personal_tutor" ? "personal_tutor" :
        assignment_type === "group_coaching_society" ? "group_coaching" :
        assignment_type === "group_coaching_school" ? "school_student" :
        null;

    if (assignment_type === "individual_coaching" || assignment_type === "personal_tutor") {
        const baseWhere = {
            professional_id,
            session_type: sessionType,
            ...(activity_id ? { activity_id } : {}),
        };

        // Fetch only sessions within the current cycle window (windowStart → cycleEnd).
        // Sessions beyond cycleEnd belong to the next settlement cycle.
        const allSessions = await prisma.sessions.findMany({
            where: {
                ...baseWhere,
                status: { in: ["completed", "scheduled", "ongoing", "absent"] },
                scheduled_date: { gte: windowStart, lte: cycleEnd },
            },
            select: { student_id: true, status: true, scheduled_date: true },
        });

        // Aggregate totals for the card header
        const completed = allSessions.filter((s) => s.status === "completed" && new Date(s.scheduled_date) <= now).length;
        const absent    = allSessions.filter((s) => s.status === "absent"    && new Date(s.scheduled_date) <= now).length;
        const upcoming  = allSessions.filter((s) => ["scheduled", "ongoing"].includes(s.status) && new Date(s.scheduled_date) >= now).length;
        const total     = completed + absent;

        // Build per-student session counts
        const perStudentMap = {};
        for (const s of allSessions) {
            if (!s.student_id) continue;
            if (!perStudentMap[s.student_id]) {
                perStudentMap[s.student_id] = { completed: 0, absent: 0, upcoming: 0 };
            }
            const d = new Date(s.scheduled_date);
            if (s.status === "completed" && d <= now)                              perStudentMap[s.student_id].completed++;
            else if (s.status === "absent" && d <= now)                            perStudentMap[s.student_id].absent++;
            else if (["scheduled", "ongoing"].includes(s.status) && d >= now)      perStudentMap[s.student_id].upcoming++;
        }

        const studentIds = Object.keys(perStudentMap).map(Number);
        let students = [];

        if (assignment_type === "individual_coaching") {
            const rows = studentIds.length > 0 ? await prisma.individual_participants.findMany({
                where: { student_id: { in: studentIds } },
                select: {
                    id: true,
                    student_id: true,
                    activity: true,
                    term_months: true,
                    membership_end_date: true,
                    students: {
                        select: {
                            id: true,
                            user_id: true,
                            users: { select: { full_name: true, mobile: true } },
                        },
                    },
                },
            }) : [];
            students = rows.map((r) => {
                const counts = perStudentMap[r.student_id] ?? { completed: 0, absent: 0, upcoming: 0 };
                return {
                    student_id:           r.student_id,
                    user_id:              r.students?.user_id ?? null,
                    name:                 r.students?.users?.full_name ?? "—",
                    mobile:               r.students?.users?.mobile ?? null,
                    activity:             r.activity ?? null,
                    term_months:          r.term_months ?? null,
                    membership_end_date:  r.membership_end_date ?? null,
                    service_type:         "individual_coaching",
                    society_category:     null,
                    custom_category_name: null,
                    sessions_completed:   counts.completed,
                    sessions_absent:      counts.absent,
                    sessions_upcoming:    counts.upcoming,
                };
            });
        } else {
            const rows = studentIds.length > 0 ? await prisma.personal_tutors.findMany({
                where: { student_id: { in: studentIds } },
                select: {
                    id: true,
                    student_id: true,
                    teacher_for: true,
                    term_months: true,
                    membership_end_date: true,
                    students: {
                        select: {
                            id: true,
                            user_id: true,
                            users: { select: { full_name: true, mobile: true } },
                        },
                    },
                },
            }) : [];
            students = rows.map((r) => {
                const counts = perStudentMap[r.student_id] ?? { completed: 0, absent: 0, upcoming: 0 };
                return {
                    student_id:           r.student_id,
                    user_id:              r.students?.user_id ?? null,
                    name:                 r.students?.users?.full_name ?? "—",
                    mobile:               r.students?.users?.mobile ?? null,
                    activity:             r.teacher_for ?? null,
                    term_months:          r.term_months ?? null,
                    membership_end_date:  r.membership_end_date ?? null,
                    service_type:         "personal_tutor",
                    society_category:     null,
                    custom_category_name: null,
                    sessions_completed:   counts.completed,
                    sessions_absent:      counts.absent,
                    sessions_upcoming:    counts.upcoming,
                };
            });
        }

        // Derive the membership end date from the first student (all students in a single
        // PT/IC assignment share the same professional, so their end dates align).
        const membershipEndDate = students[0]?.membership_end_date ?? null;

        return {
            upcoming_sessions:   upcoming,
            absent_sessions:     absent,
            attendance_pct:      total > 0 ? Math.round((completed / total) * 100) : 0,
            batch_info:          null,
            membership_end_date: membershipEndDate,
            students,
        };
    }

    const batchWhere = {
        professional_id,
        session_type: sessionType,
        batches: {
            ...(society_id  ? { society_id }  : {}),
            ...(school_id   ? { school_id }   : {}),
            ...(activity_id ? { activity_id } : {}),
        },
    };

    const [completed, upcoming, absent, matchingSessions] = await Promise.all([
        prisma.sessions.count({
            where: {
                ...batchWhere,
                status:         "completed",
                scheduled_date: { gte: windowStart, lte: now },
            },
        }),
        prisma.sessions.count({
            where: {
                ...batchWhere,
                status:         { in: ["scheduled", "ongoing"] },
                scheduled_date: { gte: now },
            },
        }),
        prisma.sessions.count({
            where: {
                ...batchWhere,
                status:         "absent",
                scheduled_date: { gte: windowStart, lte: now },
            },
        }),
        prisma.sessions.findMany({
            where: {
                ...batchWhere,
                status: { in: ["completed", "scheduled", "ongoing", "absent"] },
                scheduled_date: { gte: windowStart },
            },
            select: { batch_id: true },
            orderBy: { scheduled_date: "desc" },
        }),
    ]);

    const batchIds = [...new Set(matchingSessions.map((s) => s.batch_id).filter(Boolean))];
    const batch = await prisma.batches.findFirst({
        where: {
            ...(society_id  ? { society_id }  : {}),
            ...(school_id   ? { school_id }   : {}),
            ...(activity_id ? { activity_id } : {}),
            ...(batchIds.length ? { id: { in: batchIds } } : {}),
        },
        select: {
            id: true, batch_name: true, days_of_week: true, start_time: true, end_time: true,
            start_date: true, end_date: true,
            activities: { select: { name: true } },
            societies:  { select: { society_name: true } },
            schools:    { select: { school_name: true } },
            _count:     { select: { batch_students: true } },
        },
    });

    const batchId = batch?.id ?? null;

    const total = completed + absent;
    return {
        upcoming_sessions: upcoming,
        absent_sessions:   absent,
        attendance_pct:    total > 0 ? Math.round((completed / total) * 100) : 0,
        batch_info: batch ? {
            batch_id:    batch.id,
            batch_name:  batch.batch_name,
            days_of_week: batch.days_of_week,
            start_time:  batch.start_time,
            end_time:    batch.end_time,
            start_date:  batch.start_date,
            end_date:    batch.end_date,
            student_count: batch._count.batch_students,
            activity_name: batch.activities?.name ?? null,
            entity_name:   batch.societies?.society_name ?? batch.schools?.school_name ?? null,
        } : null,
        students: batchId ? await (async () => {
            const isSchool = assignment_type === "group_coaching_school";

            const [bs, batchSessionRows] = await Promise.all([
                prisma.batch_students.findMany({
                    where: { batch_id: batchId },
                    select: {
                        student_id: true,
                        students: {
                            select: {
                                id: true,
                                user_id: true,
                                users: { select: { full_name: true, mobile: true } },
                                individual_participants: {
                                    select: {
                                        term_months: true,
                                        activity: true,
                                        batch_id: true,
                                        individual_participants_society: {
                                            select: {
                                                societies: {
                                                    select: {
                                                        society_category: true,
                                                        custom_category_name: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                school_students: {
                                    select: { term_months: true },
                                },
                            },
                        },
                    },
                }),
                // Fetch per-student session counts for this batch in the settlement window
                prisma.sessions.findMany({
                    where: {
                        batch_id: batchId,
                        professional_id,
                        status: { in: ["completed", "absent", "scheduled", "ongoing"] },
                        scheduled_date: { gte: windowStart },
                    },
                    select: { student_id: true, status: true, scheduled_date: true },
                }),
            ]);

            // Build per-student session count map from session_participants
            // For batch sessions student_id on the session is null — attendance is tracked via session_participants
            // Fall back to batch-level counts divided equally if session_participants not available
            const participantRows = await prisma.session_participants.findMany({
                where: {
                    sessions: {
                        batch_id: batchId,
                        professional_id,
                        scheduled_date: { gte: windowStart },
                    },
                },
                select: {
                    student_id: true,
                    attendance_status: true,
                    sessions: { select: { scheduled_date: true, status: true } },
                },
            });

            const perStudentMap = {};
            for (const p of participantRows) {
                if (!p.student_id) continue;
                if (!perStudentMap[p.student_id]) {
                    perStudentMap[p.student_id] = { completed: 0, absent: 0, upcoming: 0 };
                }
                const d = new Date(p.sessions.scheduled_date);
                const sessionStatus = p.sessions.status;
                if (p.attendance_status === "present" && d <= now)                              perStudentMap[p.student_id].completed++;
                else if (p.attendance_status === "absent" && d <= now)                          perStudentMap[p.student_id].absent++;
                else if (["scheduled", "ongoing"].includes(sessionStatus) && d >= now)          perStudentMap[p.student_id].upcoming++;
            }

            const activityName = batch?.activities?.name ?? null;

            return bs.map((r) => {
                const ip = isSchool ? null
                    : (r.students?.individual_participants ?? []).find(
                        (p) => (!activityName || p.activity === activityName) && (!p.batch_id || p.batch_id === batchId)
                      ) ?? (r.students?.individual_participants ?? []).find(
                        (p) => !activityName || p.activity === activityName
                      );

                const sc   = isSchool ? null : (ip?.individual_participants_society?.societies ?? null);
                const term = isSchool
                    ? (r.students?.school_students?.[0]?.term_months ?? 9)
                    : (ip?.term_months ?? null);

                const counts = perStudentMap[r.student_id] ?? { completed: 0, absent: 0, upcoming: 0 };

                return {
                    student_id:           r.student_id,
                    user_id:              r.students?.user_id ?? null,
                    name:                 r.students?.users?.full_name ?? "—",
                    mobile:               r.students?.users?.mobile ?? null,
                    activity:             activityName,
                    term_months:          term,
                    service_type:         isSchool ? "school_student" : "group_coaching",
                    society_category:     sc?.society_category ?? null,
                    custom_category_name: sc?.custom_category_name ?? null,
                    sessions_completed:   counts.completed,
                    sessions_absent:      counts.absent,
                    sessions_upcoming:    counts.upcoming,
                };
            });
        })() : [],
    };
};

/**
 * Get commissions for a professional (their Payouts tab).
 */
exports.getProfessionalCommissions = async (professionalId) => {
    return await prisma.commissions.findMany({
        where: { professional_id: professionalId },
        orderBy: { created_at: "desc" },
    });
};

// ── ME settlement ─────────────────────────────────────────────────────────

/**
 * Get all societies for ME with activity and student counts.
 */
exports.getMESocietySummary = async (meProfessionalId) => {
    const societies = await prisma.societies.findMany({
        where: { me_professional_id: meProfessionalId },
        select: {
            id:           true,
            society_name: true,
            individual_participants: {
                select: { activity: true, students: { select: { user_id: true } } },
            },
        },
        orderBy: { created_at: "desc" },
    });

    return societies.map((s) => {
        const activitySet = new Set(s.individual_participants.map((ip) => ip.activity).filter(Boolean));
        return {
            society_id:      s.id,
            society_name:    s.society_name,
            activity_count:  activitySet.size,
            activities:      Array.from(activitySet),
            student_count:   s.individual_participants.length,
        };
    });
};

/**
 * Get student breakdown for ME "Describe Settlement" modal.
 * Returns each student's name, activity, term_months, total amount paid, and 5% ME earns.
 */
exports.getMESocietySettlementDescribe = async (societyId, meProfessionalId, meCommissionRate) => {
    // Verify society belongs to this ME
    const society = await prisma.societies.findFirst({
        where: { id: societyId, me_professional_id: meProfessionalId },
        select: { id: true, society_name: true },
    });
    if (!society) return null;

    const participants = await prisma.individual_participants.findMany({
        where: { society_id: societyId },
        select: {
            id:          true,
            activity:    true,
            term_months: true,
            students: {
                select: {
                    user_id: true,
                    users: {
                        select: {
                            full_name: true,
                            payments: {
                                where:   { service_type: { in: ["activity_purchase_group", "group_coaching"] }, status: "captured" },
                                select:  { amount: true, term_months: true, captured_at: true },
                                orderBy: { captured_at: "desc" },
                                take:    1,
                            },
                        },
                    },
                },
            },
        },
        orderBy: { id: "asc" },
    });

    let totalSettlement = 0;
    const rows = participants.map((ip) => {
        const payment     = ip.students?.users?.payments?.[0] ?? null;
        const upfrontFee  = payment ? parseFloat(payment.amount) : 0;
        const termMonths  = ip.term_months ?? payment?.term_months ?? 1;
        const meEarns     = parseFloat(((upfrontFee * meCommissionRate) / 100).toFixed(2));
        totalSettlement  += meEarns;

        return {
            student_name:  ip.students?.users?.full_name ?? null,
            activity:      ip.activity,
            term_months:   termMonths,
            upfront_fee:   upfrontFee,
            me_earns:      meEarns,
            captured_at:   payment?.captured_at ?? null,
        };
    });

    return {
        society_id:       societyId,
        society_name:     society.society_name,
        commission_rate:  meCommissionRate,
        students:         rows,
        total_settlement: parseFloat(totalSettlement.toFixed(2)),
    };
};

/**
 * Count students enrolled in a society (for 20-student threshold check).
 */
exports.countSocietyStudents = async (societyId) => {
    return await prisma.individual_participants.count({ where: { society_id: societyId } });
};

/**
 * Check if ME commission for a society is already pending/paid (already settled).
 */
exports.getMECommissionForSociety = async (meProfessionalId, societyId) => {
    return await prisma.commissions.findFirst({
        where: {
            professional_id:   meProfessionalId,
            professional_type: "marketing_executive",
            source_type:       "group_coaching_society",
            entity_id:         societyId,
            status:            { in: ["pending", "approved", "paid"] },
        },
    });
};

// ── Vendor panel ─────────────────────────────────────────────────────────

/**
 * Get vendor panel data: listed products and recent orders with commission breakup.
 */
exports.getVendorPanelData = async (vendorProfessionalId) => {
    // Find vendor record from professional_id
    const vendor = await prisma.vendors.findFirst({
        where: { professional_id: vendorProfessionalId },
        select: { id: true },
    });
    if (!vendor) return null;

    const [products, orders] = await Promise.all([
        prisma.vendor_products.findMany({
            where: { vendor_id: vendor.id },
            select: {
                id:                    true,
                product_name:          true,
                sports_category:       true,
                price:                 true,
                selling_price:         true,
                stock:                 true,
                description:           true,
                product_image:         true,
                within_city_charge:    true,
                within_state_charge:   true,
                outside_state_charge:  true,
                age_groups:            true,
            },
            orderBy: { id: "desc" },
        }),
        prisma.kit_orders.findMany({
            where:   { vendor_id: vendor.id, payment_status: "paid" },
            orderBy: { id: "desc" },
            take:    20,
            select: {
                id:              true,
                quantity:        true,
                unit_price:      true,
                delivery_charge: true,
                total_amount:    true,
                order_status:    true,
                created_at:      true,
                vendor_products: { select: { id: true, product_name: true, price: true } },
                users_kit_orders_student_user_idTousers: {
                    select: { full_name: true },
                },
            },
        }),
    ]);

    // Fetch commissions for these orders separately (no direct Prisma relation)
    const orderIds = orders.map((o) => o.id);
    const commissions = orderIds.length > 0
        ? await prisma.commissions.findMany({
            where: {
                professional_id:   vendorProfessionalId,
                professional_type: "vendor",
                source_type:       "kit_order",
                source_id:         { in: orderIds },
            },
            select: { id: true, source_id: true, commission_amount: true, status: true },
          })
        : [];
    const commissionByOrderId = Object.fromEntries(commissions.map((c) => [c.source_id, c]));

    const enrichedOrders = orders.map((o) => {
        const unitPrice      = parseFloat(o.unit_price);
        const purchasePrice  = parseFloat(o.vendor_products?.price ?? 0);
        const deliveryCharge = parseFloat(o.delivery_charge);
        const qty            = o.quantity;

        const profitMargin  = (unitPrice - purchasePrice) * qty;
        const profitShare   = parseFloat((profitMargin * 0.90).toFixed(2));
        const baseAmount    = purchasePrice * qty;
        const settlement    = parseFloat((baseAmount + deliveryCharge + profitShare).toFixed(2));
        const commission    = commissionByOrderId[o.id] ?? null;

        return {
            order_id:          o.id,
            product_name:      o.vendor_products?.product_name ?? null,
            buyer_name:        o.users_kit_orders_student_user_idTousers?.full_name ?? null,
            order_date:        o.created_at,
            order_status:      o.order_status,
            base_price:        baseAmount,
            transport:         deliveryCharge,
            profit_margin:     profitMargin,
            profit_share_90:   profitShare,
            settlement:        settlement,
            commission_id:     commission?.id ?? null,
            commission_status: commission?.status ?? null,
        };
    });

    return {
        products: products.map((p) => ({
            ...p,
            price:        parseFloat(p.price),
            selling_price: parseFloat(p.selling_price),
        })),
        orders: enrichedOrders,
    };
};

/**
 * Get pending commission id for a kit order for a vendor.
 */
exports.getVendorOrderCommission = async (vendorProfessionalId, orderId) => {
    return await prisma.commissions.findFirst({
        where: {
            professional_id:   vendorProfessionalId,
            professional_type: "vendor",
            source_type:       "kit_order",
            source_id:         orderId,
        },
    });
};

// ── Student detail (GET /admin/students/:studentId) ───────────────────────

exports.getStudentDetail = async (studentId) => {
    const sid = Number(studentId);
    return await prisma.students.findUnique({
        where: { id: sid },
        select: {
            id: true,
            student_type: true,
            users: {
                select: {
                    id: true,
                    full_name: true,
                    mobile: true,
                    email: true,
                    address: true,
                    photo: true,
                    approval_status: true,
                    created_at: true,
                },
            },
            personal_tutors: {
                select: {
                    id: true,
                    dob: true,
                    standard: true,
                    batch: true,
                    teacher_for: true,
                    preferred_time: true,
                    term_months: true,
                    membership_start_date: true,
                    membership_end_date: true,
                    session_cap: true,
                    session_days_of_week: true,
                    session_start_time: true,
                    session_end_time: true,
                    is_active: true,
                    teacher_professional_id: true,
                    professionals: {
                        select: {
                            id: true,
                            users: { select: { full_name: true, mobile: true } },
                            teachers: { select: { subject: true } },
                        },
                    },
                },
            },
            individual_participants: {
                select: {
                    id: true,
                    participant_name: true,
                    mobile: true,
                    flat_no: true,
                    dob: true,
                    age: true,
                    society_id: true,
                    society_name: true,
                    activity: true,
                    kits: true,
                    preferred_batch: true,
                    preferred_time: true,
                    term_months: true,
                    membership_start_date: true,
                    membership_end_date: true,
                    session_cap: true,
                    session_days_of_week: true,
                    session_start_time: true,
                    session_end_time: true,
                    is_active: true,
                    trainer_professional_id: true,
                    batch_id: true,
                    professionals: {
                        select: {
                            id: true,
                            users: { select: { full_name: true, mobile: true } },
                            trainers: { select: { category: true, specified_game: true } },
                        },
                    },
                    societies: { select: { id: true, society_name: true, address: true } },
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
                    term_months: true,
                    membership_start_date: true,
                    membership_end_date: true,
                    is_active: true,
                    school_id: true,
                    schools: { select: { id: true, school_name: true, address: true } },
                },
            },
            batch_students: {
                select: {
                    id: true,
                    joined_at: true,
                    batches: {
                        select: {
                            id: true,
                            batch_name: true,
                            batch_type: true,
                            days_of_week: true,
                            start_time: true,
                            end_time: true,
                            start_date: true,
                            end_date: true,
                            is_active: true,
                            activities: { select: { id: true, name: true } },
                            professionals: {
                                select: {
                                    id: true,
                                    users: { select: { full_name: true, mobile: true } },
                                },
                            },
                            societies: { select: { id: true, society_name: true } },
                            schools: { select: { id: true, school_name: true } },
                        },
                    },
                },
            },
            parent_consents: {
                select: {
                    id: true,
                    participant_name: true,
                    dob: true,
                    age: true,
                    society_name: true,
                    activity_enrolled: true,
                    parent_name: true,
                    emergency_contact_no: true,
                    parent_signature_doc: true,
                    consent_date: true,
                    created_at: true,
                },
                orderBy: { created_at: "desc" },
            },
        },
    });
};

// ── Update individual_participant record ──────────────────────────────────
exports.updateIndividualParticipant = async (id, data) => {
    return await prisma.individual_participants.update({
        where: { id: Number(id) },
        data,
    });
};

// ── Update personal_tutor record ──────────────────────────────────────────
exports.updatePersonalTutor = async (id, data) => {
    return await prisma.personal_tutors.update({
        where: { id: Number(id) },
        data,
    });
};

// ── Update school_student record ──────────────────────────────────────────
exports.updateSchoolStudent = async (id, data) => {
    return await prisma.school_students.update({
        where: { id: Number(id) },
        data,
    });
};
