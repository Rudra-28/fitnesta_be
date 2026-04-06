/**
 * Commission Service
 *
 * Trigger points:
 *  calculateMEAdmissionCommission   → finalizeRegistration (after payment)
 *  recordTrainerAssignment          → adminService.assignTrainer  (replaces old calculateTrainerCommission)
 *  recordTeacherAssignment          → adminService.assignTeacher  (replaces old calculateTeacherCommission)
 *  calculateMEOnboardingCommission  → adminService.approveRegistration
 *  upsertTravellingAllowance        → trainer batch recorded
 *  previewSettlement                → admin GET /settlement/preview
 *  confirmSettlement                → admin POST /settlement/confirm
 *
 * All functions are fire-and-forget safe where noted.
 */

const prisma = require("../../config/prisma");
const repo   = require("./commissionrepo");

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Resolve the effective monthly fee for a student.
 * - term_months = 1 → effective_monthly is null in DB, use total_fee
 * - school students → total_fee / 9
 * - others          → effective_monthly from fee_structures
 *
 * Returns a number (rupees).
 */
/**
 * Resolve the effective monthly fee for a student.
 *
 * @param {number}      studentUserId
 * @param {string}      serviceType        — 'group_coaching' | 'individual_coaching' | 'personal_tutor' | 'school_student'
 * @param {string|null} activityName
 * @param {string|null} societyCategory    — pass directly for group_coaching (avoids a DB round-trip per student)
 *
 * Rules:
 *  - school_student  → total_fee / 9
 *  - term_months = 1 → effective_monthly is null in DB, use total_fee directly
 *  - others          → look up fee_structures by coaching_type + society_category + activity + term_months
 */
async function resolveEffectiveMonthly(studentUserId, serviceType, activityName, societyCategory) {
    const rows = await prisma.$queryRaw`
        SELECT amount, term_months FROM payments
        WHERE  student_user_id = ${studentUserId}
          AND  service_type    = ${serviceType}
          AND  status          = 'captured'
        ORDER BY captured_at DESC LIMIT 1
    `;
    const payment = rows[0];
    if (!payment) return null;

    const termMonths = payment.term_months ?? 1;
    const totalFee   = parseFloat(payment.amount);

    if (serviceType === "school_student") return parseFloat((totalFee / 9).toFixed(2));
    if (termMonths === 1)                 return totalFee;

    const coachingTypeMap = {
        group_coaching:      "group_coaching",
        individual_coaching: "individual_coaching",
        personal_tutor:      "personal_tutor",
    };
    const coachingType = coachingTypeMap[serviceType];
    if (!coachingType) return totalFee;

    const fs = await prisma.fee_structures.findFirst({
        where: {
            coaching_type: coachingType,
            term_months:   termMonths,
            ...(societyCategory ? { society_category: societyCategory } : {}),
            ...(activityName    ? { activities: { name: activityName } } : {}),
        },
        select: { effective_monthly: true, total_fee: true },
    });

    if (!fs) return totalFee;
    return fs.effective_monthly !== null
        ? parseFloat(fs.effective_monthly)
        : parseFloat(fs.total_fee);
}

// ── ME Admission Commission ────────────────────────────────────────────────

exports.calculateMEAdmissionCommission = async (serviceType, formData, studentUserId, amount) => {
    try {
        if (serviceType === "school_student") return;

        let societyId = null;
        if (serviceType === "individual_coaching" || serviceType === "group_coaching") {
            societyId = formData.individualcoaching?.society_id ?? null;
        } else if (serviceType === "personal_tutor") {
            societyId = formData.tutorDetails?.society_id ?? formData.society_id ?? null;
        }
        if (!societyId) return;

        const rules   = await repo.getAllRules();
        const society = await repo.getSocietyById(parseInt(societyId));
        if (!society?.me_professional_id) return;

        const ruleKeyMap = {
            group_coaching:      "me_group_admission_rate",
            individual_coaching: "me_personal_coaching_admission_rate",
            personal_tutor:      "me_personal_tutor_admission_rate",
        };
        const rule = rules[ruleKeyMap[serviceType]];
        if (!rule) return;

        const rate             = parseFloat(rule.value);
        const commissionAmount = parseFloat(((amount * rate) / 100).toFixed(2));

        const sourceTypeMap = {
            group_coaching:      "group_coaching_society",
            individual_coaching: "individual_coaching",
            personal_tutor:      "personal_tutor",
        };

        const isGroup       = serviceType === "group_coaching";
        const initialStatus = isGroup ? "on_hold" : "pending";

        await repo.recordCommission({
            professionalId:   society.me_professional_id,
            professionalType: "marketing_executive",
            sourceType:       sourceTypeMap[serviceType],
            sourceId:         studentUserId,
            baseAmount:       amount,
            commissionRate:   rate,
            commissionAmount,
            status:           initialStatus,
            skipWallet:       isGroup,
        });

        if (isGroup) {
            const minThreshold = parseFloat(rules.me_group_admission_min_students?.value ?? 20);
            const studentCount = await repo.countGroupStudentsForEntity({ societyId: parseInt(societyId) });
            if (studentCount >= minThreshold) {
                await repo.releaseHeldCommissions(society.me_professional_id, "group_coaching_society");
            }
        }
    } catch (err) {
        console.error("[CommissionService] calculateMEAdmissionCommission error:", err.message);
    }
};

// ── Assignment recording (replaces old per-student commission calc) ────────

/**
 * When admin assigns a trainer, create/update a trainer_assignment record.
 * Sessions_allocated is pulled from commission_rules defaults; admin can edit later.
 * NO commission is recorded here — that happens at settlement time.
 */
exports.recordTrainerAssignment = async (individualParticipantId, trainerProfessionalId) => {
    try {
        const rules = await repo.getAllRules();
        const ip    = await prisma.individual_participants.findUnique({
            where:  { id: individualParticipantId },
            select: { society_id: true, activity: true, students: { select: { student_type: true } } },
        });
        if (!ip) return;

        const studentType = ip.students?.student_type;
        let assignmentType, sessionsAllocated, activityId = null;

        if (studentType === "individual_coaching") {
            assignmentType     = "individual_coaching";
            sessionsAllocated  = parseInt(rules.trainer_individual_sessions_cap?.value ?? 20);
        } else if (studentType === "group_coaching" && ip.society_id) {
            assignmentType     = "group_coaching_society";
            sessionsAllocated  = null; // admin sets this via PATCH /assignments/:id/sessions-cap
        } else {
            return;
        }

        if (ip.activity) {
            const act = await prisma.activities.findFirst({ where: { name: ip.activity }, select: { id: true } });
            activityId = act?.id ?? null;
        }

        const existing = await prisma.trainer_assignments.findFirst({
            where: {
                professional_id: trainerProfessionalId,
                assignment_type: assignmentType,
                society_id:      ip.society_id ?? null,
                activity_id:     activityId,
                is_active:       true,
            },
        });
        if (!existing) {
            await prisma.trainer_assignments.create({
                data: {
                    professional_id:    trainerProfessionalId,
                    professional_type:  "trainer",
                    assignment_type:    assignmentType,
                    society_id:         ip.society_id ?? null,
                    school_id:          null,
                    activity_id:        activityId,
                    sessions_allocated: sessionsAllocated,
                    assigned_from:      new Date(),
                    is_active:          true,
                },
            });
        }
    } catch (err) {
        console.error("[CommissionService] recordTrainerAssignment error:", err.message);
    }
};

/**
 * When admin assigns a teacher to a personal_tutor student,
 * record the assignment. No commission yet.
 */
exports.recordTeacherAssignment = async (_personalTutorId, teacherProfessionalId) => {
    try {
        const rules = await repo.getAllRules();
        const sessionsAllocated = parseInt(rules.teacher_personal_tutor_sessions_cap?.value ?? 20);

        const existing = await prisma.trainer_assignments.findFirst({
            where: {
                professional_id: teacherProfessionalId,
                assignment_type: "personal_tutor",
                is_active:       true,
            },
        });
        if (!existing) {
            await prisma.trainer_assignments.create({
                data: {
                    professional_id:    teacherProfessionalId,
                    professional_type:  "teacher",
                    assignment_type:    "personal_tutor",
                    society_id:         null,
                    school_id:          null,
                    activity_id:        null,
                    sessions_allocated: sessionsAllocated,
                    assigned_from:      new Date(),
                    is_active:          true,
                },
            });
        }
    } catch (err) {
        console.error("[CommissionService] recordTeacherAssignment error:", err.message);
    }
};

/**
 * Called by admin when assigning a trainer to a school batch.
 * schoolId + activityId are passed directly.
 */
exports.recordSchoolTrainerAssignment = async (trainerProfessionalId, schoolId, activityId) => {
    try {
        const rules = await repo.getAllRules();
        const sessionsAllocated = parseInt(rules.trainer_group_school_sessions_cap?.value ?? 18);

        const existing = await prisma.trainer_assignments.findFirst({
            where: {
                professional_id: trainerProfessionalId,
                assignment_type: "group_coaching_school",
                school_id:       schoolId,
                activity_id:     activityId ?? null,
                is_active:       true,
            },
        });
        if (!existing) {
            await prisma.trainer_assignments.create({
                data: {
                    professional_id:    trainerProfessionalId,
                    professional_type:  "trainer",
                    assignment_type:    "group_coaching_school",
                    society_id:         null,
                    school_id:          schoolId,
                    activity_id:        activityId ?? null,
                    sessions_allocated: sessionsAllocated,
                    assigned_from:      new Date(),
                    is_active:          true,
                },
            });
        }
    } catch (err) {
        console.error("[CommissionService] recordSchoolTrainerAssignment error:", err.message);
    }
};

// ── Settlement ─────────────────────────────────────────────────────────────

/**
 * Build the settlement preview for all active assignments.
 * Returns an array of line items — one per assignment — with calculated commission.
 * Does NOT write anything to DB.
 *
 * @param {number|null} professionalId  — filter to a single professional (optional)
 */
exports.previewSettlement = async (professionalId = null) => {
    const rules = await repo.getAllRules();

    const assignments = await prisma.trainer_assignments.findMany({
        where: {
            is_active: true,
            ...(professionalId ? { professional_id: professionalId } : {}),
        },
        include: {
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true, mobile: true } } } },
            societies:     { select: { id: true, society_name: true, society_category: true } },
            schools:       { select: { id: true, school_name: true } },
            activities:    { select: { id: true, name: true } },
        },
    });

    const results = [];

    for (const a of assignments) {
        try {
            const item = await buildSettlementItem(a, rules);
            results.push(item);
        } catch (err) {
            console.error(`[Settlement] preview error for assignment ${a.id}:`, err.message);
        }
    }

    return results;
};

/**
 * Confirm settlement: commit all (or filtered) active assignments.
 * Creates commission records, updates last_settled_at.
 *
 * @param {number[]|null} assignmentIds — specific IDs to settle (null = all active)
 */
exports.confirmSettlement = async (assignmentIds = null) => {
    const rules = await repo.getAllRules();

    const assignments = await prisma.trainer_assignments.findMany({
        where: {
            is_active: true,
            ...(assignmentIds ? { id: { in: assignmentIds } } : {}),
        },
        include: {
            professionals: { select: { id: true, profession_type: true, users: { select: { full_name: true } } } },
            societies:     { select: { id: true, society_name: true, society_category: true } },
            schools:       { select: { id: true, school_name: true } },
            activities:    { select: { id: true, name: true } },
        },
    });

    const settled = [];

    for (const a of assignments) {
        try {
            const item = await buildSettlementItem(a, rules);

            if (item.commission_amount <= 0) {
                settled.push({ assignment_id: a.id, skipped: true, reason: "zero commission" });
                continue;
            }

            // Record commission
            await repo.recordCommission({
                professionalId:   a.professional_id,
                professionalType: a.professional_type === "teacher" ? "teacher" : "trainer",
                sourceType:       a.assignment_type,
                sourceId:         a.id, // assignment id as source
                baseAmount:       item.effective_fee_base,
                commissionRate:   item.commission_rate,
                commissionAmount: item.commission_amount,
                status:           "pending",
                skipWallet:       false,
                // Extra metadata stored in notes via a description field we'll add
            });

            // Stamp settlement date
            await prisma.trainer_assignments.update({
                where: { id: a.id },
                data:  { last_settled_at: new Date() },
            });

            settled.push({ assignment_id: a.id, ...item });
        } catch (err) {
            console.error(`[Settlement] confirm error for assignment ${a.id}:`, err.message);
            settled.push({ assignment_id: a.id, error: err.message });
        }
    }

    return settled;
};

// ── Settlement core calculation ────────────────────────────────────────────

async function buildSettlementItem(assignment, rules) {
    const { id, professional_id, professional_type, assignment_type, society_id, school_id, activity_id,
            sessions_allocated, assigned_from, last_settled_at, professionals, societies, schools, activities } = assignment;

    // ── 1. Count sessions attended in the settlement window ──────────────
    const windowStart = last_settled_at
        ? new Date(last_settled_at)
        : new Date(assigned_from);
    const windowEnd = new Date();

    const sessionsAttended = await prisma.trainer_batches.count({
        where: {
            trainer_professional_id: professional_id,
            ...(society_id  ? { society_id }  : {}),
            ...(school_id   ? { school_id }   : {}),
            ...(activity_id ? { activity_id } : {}),
            batch_date: { gte: windowStart, lte: windowEnd },
        },
    });

    // ── 2. Sum effective monthly fees of students in this assignment ──────
    let effectiveFeeBase = 0;
    let commissionRate   = 0;
    let isFlat           = false;
    let flatAmountPerSession = 0;

    if (assignment_type === "group_coaching_society" && society_id) {
        // society_category is already loaded via the assignment's societies relation —
        // pass it directly so resolveEffectiveMonthly doesn't re-query per student
        const societyCategory = societies?.society_category ?? null;

        const students = await prisma.individual_participants.findMany({
            where: {
                society_id,
                ...(activities?.name ? { activity: activities.name } : {}),
                students: { student_type: "group_coaching" },
            },
            select: { students: { select: { user_id: true } } },
        });

        for (const s of students) {
            const uid = s.students?.user_id;
            if (!uid) continue;
            const em = await resolveEffectiveMonthly(uid, "group_coaching", activities?.name ?? null, societyCategory);
            if (em) effectiveFeeBase += em;
        }

        const minStudents   = parseFloat(rules.trainer_group_society_min_students?.value ?? 10);
        const studentCount  = await repo.countSocietyStudentsForActivity(society_id, activities?.name ?? null);

        if (studentCount < minStudents) {
            isFlat               = true;
            flatAmountPerSession = parseFloat(rules.trainer_group_society_flat_amount?.value ?? 300);
        } else {
            commissionRate = parseFloat(rules.trainer_group_society_rate?.value ?? 50);
        }

    } else if (assignment_type === "group_coaching_school" && school_id) {
        const schoolStudents = await prisma.school_students.findMany({
            where: { school_id },
            select: { students: { select: { user_id: true } } },
        });

        for (const s of schoolStudents) {
            const uid = s.students?.user_id;
            if (!uid) continue;
            const payment = await prisma.$queryRaw`
                SELECT amount FROM payments
                WHERE student_user_id = ${uid} AND service_type = 'school_student' AND status = 'captured'
                ORDER BY captured_at DESC LIMIT 1
            `;
            if (payment[0]) effectiveFeeBase += parseFloat((parseFloat(payment[0].amount) / 9).toFixed(2));
        }

        commissionRate = parseFloat(rules.trainer_group_school_rate?.value ?? 45);

    } else if (assignment_type === "individual_coaching") {
        const participants = await prisma.individual_participants.findMany({
            where: {
                trainer_professional_id: professional_id,
                students: { student_type: "individual_coaching" },
            },
            select: { society_id: true, activity: true, students: { select: { user_id: true } } },
        });

        for (const p of participants) {
            const uid = p.students?.user_id;
            if (!uid) continue;
            const em = await resolveEffectiveMonthly(uid, "individual_coaching", p.activity, null);
            if (em) effectiveFeeBase += em;
        }

        commissionRate = parseFloat(rules.trainer_personal_coaching_rate?.value ?? 80);

    } else if (assignment_type === "personal_tutor") {
        const tutors = await prisma.personal_tutors.findMany({
            where: { teacher_professional_id: professional_id },
            select: { students: { select: { user_id: true } } },
        });

        for (const t of tutors) {
            const uid = t.students?.user_id;
            if (!uid) continue;
            const em = await resolveEffectiveMonthly(uid, "personal_tutor", null, null);
            if (em) effectiveFeeBase += em;
        }

        commissionRate = parseFloat(rules.teacher_personal_tutor_rate?.value ?? 80);
    }

    // ── 3. Calculate commission ───────────────────────────────────────────
    let commissionPerSession, commissionAmount;

    if (isFlat) {
        commissionPerSession = flatAmountPerSession;
        commissionAmount     = parseFloat((sessionsAttended * flatAmountPerSession).toFixed(2));
    } else {
        const totalCommissionPool = parseFloat(((effectiveFeeBase * commissionRate) / 100).toFixed(2));
        commissionPerSession      = sessions_allocated > 0
            ? parseFloat((totalCommissionPool / sessions_allocated).toFixed(2))
            : 0;
        commissionAmount          = parseFloat((sessionsAttended * commissionPerSession).toFixed(2));
    }

    return {
        assignment_id:        id,
        professional_id,
        professional_name:    professionals?.users?.full_name ?? null,
        professional_mobile:  professionals?.users?.mobile ?? null,
        professional_type,
        assignment_type,
        entity_name:          societies?.society_name ?? schools?.school_name ?? null,
        activity_name:        activities?.name ?? null,
        assigned_from:        assigned_from,
        last_settled_at:      last_settled_at,
        window_start:         windowStart,
        window_end:           windowEnd,
        sessions_allocated,
        sessions_attended:    sessionsAttended,
        effective_fee_base:   parseFloat(effectiveFeeBase.toFixed(2)),
        commission_rate:      isFlat ? 0 : commissionRate,
        is_flat_rate:         isFlat,
        flat_amount_per_session: isFlat ? flatAmountPerSession : null,
        commission_per_session: commissionPerSession,
        commission_amount:    commissionAmount,
    };
}

// ── ME Onboarding Commission ───────────────────────────────────────────────

exports.calculateMEOnboardingCommission = async (entityType, entity) => {
    try {
        if (!entity.me_professional_id) return;

        const rules = await repo.getAllRules();
        let commissionAmount, sourceType;

        if (entityType === "society") {
            sourceType = "group_coaching_society";
            const noOfFlats = entity.no_of_flats ?? 0;
            if (noOfFlats > 100)       commissionAmount = parseFloat(rules.me_society_above_100_flats?.value ?? 1111);
            else if (noOfFlats >= 50)  commissionAmount = parseFloat(rules.me_society_50_to_100_flats?.value ?? 500);
            else                       commissionAmount = parseFloat(rules.me_society_below_50_flats?.value ?? 300);
        } else if (entityType === "school") {
            sourceType       = "school_registration";
            commissionAmount = parseFloat(rules.me_school_registration?.value ?? 1111);
        } else {
            return;
        }

        await repo.recordCommission({
            professionalId:   entity.me_professional_id,
            professionalType: "marketing_executive",
            sourceType,
            sourceId:         entity.id,
            baseAmount:       0,
            commissionRate:   0,
            commissionAmount,
        });
    } catch (err) {
        console.error("[CommissionService] calculateMEOnboardingCommission error:", err.message);
    }
};

// ── Trainer Travelling Allowance ───────────────────────────────────────────

exports.upsertTravellingAllowance = async (trainerProfessionalId, date) => {
    try {
        const rules    = await repo.getAllRules();
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);

        const batchCount = await prisma.trainer_batches.count({
            where: { trainer_professional_id: trainerProfessionalId, batch_date: dateOnly },
        });
        if (batchCount === 0) return;

        const amount = batchCount === 1
            ? parseFloat(rules.ta_1_batch_amount?.value       ?? 50)
            : parseFloat(rules.ta_2_plus_batches_amount?.value ?? 100);

        await prisma.travelling_allowances.upsert({
            where: {
                trainer_professional_id_allowance_date: {
                    trainer_professional_id: trainerProfessionalId,
                    allowance_date:          dateOnly,
                },
            },
            create: { trainer_professional_id: trainerProfessionalId, allowance_date: dateOnly, batches_count: batchCount, amount, status: "pending" },
            update: { batches_count: batchCount, amount, updated_at: new Date() },
        });
    } catch (err) {
        console.error("[CommissionService] upsertTravellingAllowance error:", err.message);
    }
};
