/**
 * Commission Repository
 *
 * Low-level DB operations for commissions, wallets, and commission_rules.
 * All business logic lives in commissionservice.js — this file only touches the DB.
 */

const prisma = require("../../config/prisma");

// ── Commission rules ───────────────────────────────────────────────────────

/**
 * Load all commission rules as a map keyed by rule_key.
 * Example result:
 *   { trainer_personal_coaching_rate: { rule_key, rule_type, value, ... }, ... }
 */
exports.getAllRules = async () => {
    const rows = await prisma.commission_rules.findMany();
    return Object.fromEntries(rows.map((r) => [r.rule_key, r]));
};

exports.getRuleByKey = async (ruleKey) => {
    return await prisma.commission_rules.findUnique({ where: { rule_key: ruleKey } });
};

exports.updateRuleValue = async (ruleKey, newValue) => {
    return await prisma.commission_rules.update({
        where: { rule_key: ruleKey },
        data:  { value: newValue, updated_at: new Date() },
    });
};

// ── Commission recording ───────────────────────────────────────────────────

/**
 * Insert a commission record and credit the professional's wallet atomically.
 *
 * @param {object} params
 * @param {number}  params.professionalId
 * @param {string}  params.professionalType  — 'trainer' | 'teacher' | 'marketing_executive'
 * @param {string}  params.sourceType        — commissions_source_type enum value
 * @param {number}  params.sourceId          — ID of the entity that triggered this commission
 * @param {number}  params.baseAmount        — fee the commission was calculated on (0 for flat)
 * @param {number}  params.commissionRate    — percentage applied (0 for flat commissions)
 * @param {number}  params.commissionAmount  — final rupee amount credited
 */
exports.recordCommission = async ({
    professionalId,
    professionalType,
    sourceType,
    sourceId,
    baseAmount,
    commissionRate,
    commissionAmount,
}) => {
    await prisma.$transaction(async (tx) => {
        await tx.commissions.create({
            data: {
                professional_id:   professionalId,
                professional_type: professionalType,
                source_type:       sourceType,
                source_id:         sourceId,
                base_amount:       baseAmount,
                commission_rate:   commissionRate,
                commission_amount: commissionAmount,
                status:            "pending",
            },
        });

        // Upsert wallet: create with initial balance if first commission, else increment
        await tx.wallets.upsert({
            where:  { professional_id: professionalId },
            create: { professional_id: professionalId, balance: commissionAmount },
            update: { balance: { increment: commissionAmount }, updated_at: new Date() },
        });
    });
};

// ── Lookup helpers ─────────────────────────────────────────────────────────

/**
 * Count individual_participants enrolled in a society for a given activity.
 * Used to decide whether the < 10 student threshold applies for trainer commission.
 */
exports.countSocietyStudentsForActivity = async (societyId, activityName) => {
    return await prisma.individual_participants.count({
        where: {
            society_id: societyId,
            ...(activityName && { activity: activityName }),
        },
    });
};

/**
 * Count globally active activities (is_active = true).
 * Used to verify ME eligibility (needs min 2 active activities on the platform).
 */
exports.countGlobalActiveActivities = async () => {
    return await prisma.activities.count({ where: { is_active: true } });
};

/**
 * Find the most recent captured payment for a student user + service type.
 * Used when calculating trainer/teacher commission at assignment time.
 */
exports.getPaymentForStudent = async (studentUserId, serviceType) => {
    const rows = await prisma.$queryRaw`
        SELECT id, amount
        FROM   payments
        WHERE  student_user_id = ${studentUserId}
          AND  service_type    = ${serviceType}
          AND  status          = 'captured'
        ORDER BY captured_at DESC
        LIMIT 1
    `;
    return rows[0] ?? null;
};

/**
 * Get an individual_participant with its student type and user_id.
 * Used at trainer assignment time to determine commission type.
 */
exports.getIndividualParticipantWithStudent = async (id) => {
    return await prisma.individual_participants.findUnique({
        where:  { id },
        select: {
            id:        true,
            society_id: true,
            activity:  true,
            students:  {
                select: {
                    student_type: true,
                    user_id:      true,
                },
            },
        },
    });
};

/**
 * Get a personal_tutor record with its student's user_id.
 * Used at teacher assignment time to look up the payment.
 */
exports.getPersonalTutorWithStudent = async (id) => {
    return await prisma.personal_tutors.findUnique({
        where:  { id },
        select: {
            id:      true,
            students: {
                select: { user_id: true },
            },
        },
    });
};

/**
 * Get a society by ID (for ME info and flat count).
 */
exports.getSocietyById = async (societyId) => {
    return await prisma.societies.findUnique({ where: { id: societyId } });
};

// ── Admin — commission list ────────────────────────────────────────────────

/**
 * List commissions with optional filters.
 * @param {object} filters — { professionalType?, status?, professionalId? }
 */
exports.listCommissions = async ({ professionalType, status, professionalId } = {}) => {
    return await prisma.commissions.findMany({
        where: {
            ...(professionalType && { professional_type: professionalType }),
            ...(status           && { status }),
            ...(professionalId   && { professional_id: professionalId }),
        },
        include: {
            professionals: {
                select: {
                    id:   true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { created_at: "desc" },
    });
};

exports.markCommissionPaid = async (id) => {
    return await prisma.commissions.update({
        where: { id: Number(id) },
        data:  { status: "paid" },
    });
};

// ── Admin — travelling allowance list ─────────────────────────────────────

/**
 * List travelling allowances with optional filters.
 * @param {object} filters — { trainerProfessionalId?, status? }
 */
exports.listTravellingAllowances = async ({ trainerProfessionalId, status } = {}) => {
    return await prisma.travelling_allowances.findMany({
        where: {
            ...(trainerProfessionalId && { trainer_professional_id: trainerProfessionalId }),
            ...(status                && { status }),
        },
        include: {
            professionals: {
                select: {
                    id:   true,
                    users: { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { allowance_date: "desc" },
    });
};

exports.markTravellingAllowancePaid = async (id) => {
    return await prisma.travelling_allowances.update({
        where: { id: Number(id) },
        data:  { status: "paid", updated_at: new Date() },
    });
};
