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
    status = "pending",
    skipWallet = false,
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
                status,
            },
        });

        if (!skipWallet) {
            await tx.wallets.upsert({
                where:  { professional_id: professionalId },
                create: { professional_id: professionalId, balance: commissionAmount },
                update: { balance: { increment: commissionAmount }, updated_at: new Date() },
            });
        }
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

// ── ME Earnings Summary ────────────────────────────────────────────────────

/**
 * Returns earnings breakdown for a marketing executive:
 *   total_earnings = sum of all commission_amounts
 *   pending        = on_hold commissions (not yet admin-approved)
 *   approved       = admin-approved but threshold not yet met / not yet paid
 *   paid           = paid out
 */
exports.getMEEarningsSummary = async (meProfessionalId) => {
    const rows = await prisma.commissions.groupBy({
        by:     ["status"],
        where:  { professional_id: meProfessionalId, professional_type: "marketing_executive" },
        _sum:   { commission_amount: true },
    });

    const byStatus = Object.fromEntries(
        rows.map((r) => [r.status, parseFloat(r._sum.commission_amount ?? 0)])
    );

    const pending  = byStatus.on_hold  ?? 0;
    const approved = byStatus.approved ?? 0;
    const paid     = byStatus.paid     ?? 0;
    const total    = pending + approved + paid;

    return { total_earnings: total, pending, approved, paid };
};

/**
 * Approve a single on_hold commission (admin action).
 * Does NOT credit wallet — wallet is credited on payment (markCommissionPaid).
 */
exports.approveCommission = async (id) => {
    return await prisma.commissions.update({
        where: { id: Number(id) },
        data:  { status: "approved" },
    });
};

/**
 * Count group-coaching students in a society or school for this ME's commission threshold.
 * Excludes personal_tutor students — only group_coaching student_type counts.
 */
exports.countGroupStudentsForEntity = async ({ societyId, schoolId }) => {
    if (societyId) {
        return await prisma.individual_participants.count({
            where: {
                society_id: societyId,
                students:   { student_type: "group_coaching" },
            },
        });
    }
    if (schoolId) {
        return await prisma.school_students.count({ where: { school_id: schoolId } });
    }
    return 0;
};

/**
 * Release all on_hold commissions for a given ME + entity (society or school).
 * Sets status → 'pending' and credits the ME's wallet for each record atomically.
 *
 * @param {number} meProfessionalId
 * @param {string} sourceType  — 'group_coaching_society' | 'group_coaching_school'
 * @param {number} entityId    — societyId or schoolId (matched via source_id on the commission's admission chain)
 *
 * We identify the held commissions by professional_id + source_type + status = on_hold.
 * For society: source_id is the student's user_id and there's no direct entity link on the
 * commissions row, so we scope by professional_id + source_type + status only.
 * The caller is responsible for only invoking this once the threshold is confirmed.
 */
// ── Professional Wallet ────────────────────────────────────────────────────

/**
 * Wallet summary for any professional: totals by status bucket.
 * pending  = on_hold + pending (not yet admin-approved or still waiting)
 * approved = admin has approved, not yet paid out
 * paid     = paid out
 */
exports.getWalletSummary = async (professionalId) => {
    const rows = await prisma.commissions.groupBy({
        by:    ["status"],
        where: { professional_id: professionalId },
        _sum:  { commission_amount: true },
    });

    const byStatus = Object.fromEntries(
        rows.map((r) => [r.status, parseFloat(r._sum.commission_amount ?? 0)])
    );

    return {
        pending:   (byStatus.on_hold ?? 0) + (byStatus.pending ?? 0),
        approved:  byStatus.approved  ?? 0,
        requested: byStatus.requested ?? 0,
        paid:      byStatus.paid      ?? 0,
    };
};

/**
 * Itemized commission rows for a professional filtered by wallet bucket.
 * bucketStatus: 'pending' maps to on_hold + pending rows; 'approved' or 'paid' map directly.
 */
exports.getWalletBreakdown = async (professionalId, bucketStatus) => {
    const statusFilter =
        bucketStatus === "pending"
            ? { status: { in: ["on_hold", "pending"] } }
            : { status: bucketStatus };  // covers approved | requested | paid

    return await prisma.commissions.findMany({
        where:   { professional_id: professionalId, ...statusFilter },
        select: {
            id:                true,
            source_type:       true,
            source_id:         true,
            base_amount:       true,
            commission_rate:   true,
            commission_amount: true,
            status:            true,
            created_at:        true,
        },
        orderBy: { created_at: "desc" },
    });
};

// ── Withdrawal flow ────────────────────────────────────────────────────────

/**
 * Move all approved commissions for a professional to "requested" (withdrawal initiated).
 * Returns the total amount and count of rows updated.
 */
exports.requestWithdrawal = async (professionalId) => {
    const approved = await prisma.commissions.findMany({
        where:  { professional_id: professionalId, status: "approved" },
        select: { id: true, commission_amount: true },
    });

    if (approved.length === 0) return { count: 0, total_amount: 0 };

    const ids         = approved.map((c) => c.id);
    const totalAmount = parseFloat(
        approved.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0).toFixed(2)
    );

    await prisma.commissions.updateMany({
        where: { id: { in: ids } },
        data:  { status: "requested" },
    });

    return { count: approved.length, total_amount: totalAmount };
};

/** Store the Razorpay payout ID on the wallet after initiating a payout. */
exports.storePayout = async (professionalId, payoutId) => {
    await prisma.wallets.upsert({
        where:  { professional_id: professionalId },
        create: { professional_id: professionalId, balance: 0, last_payout_id: payoutId, last_payout_status: "processing" },
        update: { last_payout_id: payoutId, last_payout_status: "processing", updated_at: new Date() },
    });
};

/** Store contact + fund account IDs on the professional record. */
exports.storeFundAccount = async (professionalId, contactId, fundAccountId) => {
    await prisma.professionals.update({
        where: { id: professionalId },
        data:  { razorpay_contact_id: contactId, razorpay_fund_account_id: fundAccountId },
    });
};

/** Called by webhook: payout.processed → mark all requested commissions as paid. */
exports.markPayoutPaid = async (payoutId) => {
    const wallet = await prisma.wallets.findFirst({ where: { last_payout_id: payoutId } });
    if (!wallet) return;

    await prisma.$transaction(async (tx) => {
        await tx.commissions.updateMany({
            where: { professional_id: wallet.professional_id, status: "requested" },
            data:  { status: "paid" },
        });
        await tx.wallets.update({
            where: { professional_id: wallet.professional_id },
            data:  { last_payout_status: "processed", updated_at: new Date() },
        });
    });
};

/** Called by webhook: payout.failed → revert requested commissions back to approved. */
exports.revertPayoutToApproved = async (payoutId) => {
    const wallet = await prisma.wallets.findFirst({ where: { last_payout_id: payoutId } });
    if (!wallet) return;

    await prisma.$transaction(async (tx) => {
        await tx.commissions.updateMany({
            where: { professional_id: wallet.professional_id, status: "requested" },
            data:  { status: "approved" },
        });
        await tx.wallets.update({
            where: { professional_id: wallet.professional_id },
            data:  { last_payout_status: "failed", updated_at: new Date() },
        });
    });
};

/**
 * List all requested withdrawal entries across all professionals (admin view).
 * Groups by professional with total requested amount.
 */
exports.listRequestedWithdrawals = async () => {
    const rows = await prisma.commissions.findMany({
        where:   { status: "requested" },
        include: {
            professionals: {
                select: {
                    id:               true,
                    professional_type: true,
                    users:            { select: { full_name: true, mobile: true } },
                },
            },
        },
        orderBy: { created_at: "desc" },
    });
    return rows;
};

/**
 * Mark all "requested" commissions for a professional as "paid" (admin processes payout).
 * Returns total amount paid.
 */
exports.markWithdrawalsPaid = async (professionalId) => {
    const requested = await prisma.commissions.findMany({
        where:  { professional_id: professionalId, status: "requested" },
        select: { id: true, commission_amount: true },
    });

    if (requested.length === 0) return { count: 0, total_amount: 0 };

    const ids         = requested.map((c) => c.id);
    const totalAmount = parseFloat(
        requested.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0).toFixed(2)
    );

    await prisma.commissions.updateMany({
        where: { id: { in: ids } },
        data:  { status: "paid" },
    });

    return { count: requested.length, total_amount: totalAmount };
};

exports.releaseHeldCommissions = async (meProfessionalId, sourceType) => {
    const held = await prisma.commissions.findMany({
        where: {
            professional_id: meProfessionalId,
            source_type:     sourceType,
            status:          "on_hold",
        },
        select: { id: true, commission_amount: true },
    });

    if (held.length === 0) return 0;

    const totalAmount = held.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0);
    const ids         = held.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
        await tx.commissions.updateMany({
            where: { id: { in: ids } },
            data:  { status: "pending" },
        });
        await tx.wallets.upsert({
            where:  { professional_id: meProfessionalId },
            create: { professional_id: meProfessionalId, balance: totalAmount },
            update: { balance: { increment: totalAmount }, updated_at: new Date() },
        });
    });

    return held.length;
};
