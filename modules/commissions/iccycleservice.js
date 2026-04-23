"use strict";

/**
 * IC Cycle Settlement Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages per-month settlement cycles for individual_coaching participants.
 *
 * Pattern mirrors ptcycleservice.js exactly:
 *   - One row per (individual_participant × month-cycle) in ic_cycle_settlements
 *   - activity_id resolved from individual_participants.activity name at creation
 *   - Rows are pre-created when bulk sessions are generated
 *   - Pending cycles are live-synced from sessions on every GET
 *   - Settled / paid cycles are frozen
 */

const prisma = require("../../config/prisma");

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Build N cycle date windows from a membership start date.
 * Works entirely in UTC-midnight dates to avoid timezone shifts.
 */
function buildCycleWindows(membershipStart, termMonths) {
    const base = new Date(membershipStart);
    const baseY = base.getUTCFullYear();
    const baseM = base.getUTCMonth();
    const baseD = base.getUTCDate();

    const windows = [];
    for (let m = 0; m < termMonths; m++) {
        const cycleStart = new Date(Date.UTC(baseY, baseM + m, baseD));
        const cycleEnd   = new Date(Date.UTC(baseY, baseM + m + 1, baseD - 1, 23, 59, 59, 999));
        windows.push({ cycleStart, cycleEnd });
    }
    return windows;
}

/**
 * Commission rate for individual coaching trainer.
 */
async function resolveCommissionRate() {
    const rule = await prisma.commission_rules.findUnique({
        where: { rule_key: "trainer_personal_coaching_rate" },
    });
    return rule ? parseFloat(rule.value) : 80;
}

/**
 * Resolve effective monthly fee for an IC participant.
 *
 * Rule: commission base = total_fee ÷ term_months (per-month portion).
 *
 * Lookup order:
 *   1. fee_structures exact match: activity_id + individual_coaching + term_months
 *      → use effective_monthly if stored, else total_fee ÷ term_months
 *   2. Any fee_structures row for this activity + individual_coaching (any term)
 *      → divide total_fee by the participant's actual term_months
 *   3. Latest successful payment for this user ÷ term_months
 */
async function resolveEffectiveMonthly(userId, activityId, termMonths) {
    const resolvedTerm = termMonths ?? 1;

    const exact = await prisma.fee_structures.findFirst({
        where: {
            activity_id:   activityId,
            coaching_type: "individual_coaching",
            term_months:   resolvedTerm,
        },
        select: { effective_monthly: true, total_fee: true, term_months: true },
    });
    if (exact) {
        if (exact.effective_monthly) return parseFloat(exact.effective_monthly);
        return parseFloat(exact.total_fee) / resolvedTerm;
    }

    const any = await prisma.fee_structures.findFirst({
        where:   { activity_id: activityId, coaching_type: "individual_coaching" },
        orderBy: { term_months: "desc" },
        select:  { effective_monthly: true, total_fee: true, term_months: true },
    });
    if (any) {
        if (any.effective_monthly) return parseFloat(any.effective_monthly);
        return parseFloat(any.total_fee) / resolvedTerm;
    }

    const payment = await prisma.payments.findFirst({
        where:   { user_id: userId, status: "success" },
        orderBy: { created_at: "desc" },
        select:  { amount: true },
    });
    return payment ? parseFloat(payment.amount) / resolvedTerm : 0;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Pre-create cycle rows for an individual_participant after bulk session generation.
 * Called from generateIndividualSessions immediately after sessions + membership are written.
 *
 * @param {number} ipId             – individual_participants.id
 * @param {Date}   membershipStart  – first cycle start date
 * @param {number} termMonths       – total monthly cycles
 * @param {number} professionalId   – trainer's professionals.id
 */
exports.createCyclesForIC = async (ipId, membershipStart, termMonths, professionalId) => {
    const ip = await prisma.individual_participants.findUnique({
        where:  { id: ipId },
        select: {
            student_id: true,
            activity:   true,
            term_months: true,
            students:   { select: { user_id: true } },
        },
    });
    if (!ip) return;

    const userId       = ip.students?.user_id;
    const activityName = (ip.activity ?? "").trim();
    if (!activityName) return;

    const activity = await prisma.activities.findFirst({
        where:  { name: activityName },
        select: { id: true, name: true },
    });
    if (!activity) return;

    const commissionRate = await resolveCommissionRate();
    const em             = await resolveEffectiveMonthly(userId, activity.id, termMonths);
    const windows        = buildCycleWindows(membershipStart, termMonths);

    for (const { cycleStart, cycleEnd } of windows) {
        const [completed, absent, upcoming] = await Promise.all([
            prisma.sessions.count({
                where: {
                    student_id:      ip.student_id,
                    professional_id: professionalId,
                    activity_id:     activity.id,
                    session_type:    "individual_coaching",
                    status:          "completed",
                    scheduled_date:  { gte: cycleStart, lte: cycleEnd },
                },
            }),
            prisma.sessions.count({
                where: {
                    student_id:      ip.student_id,
                    professional_id: professionalId,
                    activity_id:     activity.id,
                    session_type:    "individual_coaching",
                    status:          "absent",
                    scheduled_date:  { gte: cycleStart, lte: cycleEnd },
                },
            }),
            prisma.sessions.count({
                where: {
                    student_id:      ip.student_id,
                    professional_id: professionalId,
                    activity_id:     activity.id,
                    session_type:    "individual_coaching",
                    status:          "scheduled",
                    scheduled_date:  { gte: cycleStart, lte: cycleEnd },
                },
            }),
        ]);

        const allocated     = completed + absent + upcoming;
        const commissionAmt = em > 0
            ? parseFloat(((em * commissionRate / 100) / Math.max(allocated, 1) * completed).toFixed(2))
            : 0;

        await prisma.ic_cycle_settlements.upsert({
            where: {
                individual_participant_id_professional_id_activity_id_cycle_start: {
                    individual_participant_id: ipId,
                    professional_id:           professionalId,
                    activity_id:               activity.id,
                    cycle_start:               cycleStart,
                },
            },
            create: {
                individual_participant_id: ipId,
                professional_id:           professionalId,
                activity_id:               activity.id,
                cycle_start:               cycleStart,
                cycle_end:                 cycleEnd,
                sessions_allocated:        allocated,
                sessions_attended:         completed,
                sessions_absent:           absent,
                sessions_upcoming:         upcoming,
                base_amount:               em,
                commission_rate:           commissionRate,
                commission_amount:         commissionAmt,
                status:                    "pending",
            },
            update: {
                cycle_end:          cycleEnd,
                sessions_allocated: allocated,
                sessions_attended:  completed,
                sessions_absent:    absent,
                sessions_upcoming:  upcoming,
                base_amount:        em,
                commission_rate:    commissionRate,
                commission_amount:  commissionAmt,
            },
        });
    }
};

/**
 * Live-sync all PENDING cycle rows for a trainer.
 * Re-counts sessions from live sessions table and recomputes amounts.
 * Settled / paid cycles are untouched.
 *
 * @param {number} professionalId – trainer professionals.id
 */
exports.syncPendingCycles = async (professionalId) => {
    // Query pending cycles directly by professional_id — survives reassignment because
    // the cycle row owns its professional_id independently of trainer_professional_id.
    const pendingCycles = await prisma.ic_cycle_settlements.findMany({
        where:  { professional_id: professionalId, status: "pending" },
        select: {
            id: true, individual_participant_id: true, activity_id: true,
            cycle_start: true, cycle_end: true, base_amount: true, commission_rate: true,
            individual_participants: { select: { student_id: true } },
        },
    });
    if (pendingCycles.length === 0) return;

    const commissionRate = await resolveCommissionRate();

    for (const cycle of pendingCycles) {
        const studentId = cycle.individual_participants?.student_id;
        if (!studentId) continue;

        // sessions_allocated = ALL sessions for this student in the cycle window,
        // across all trainers. This is the shared denominator so that when a trainer
        // is reassigned mid-cycle, both old and new trainer divide by the same number.
        const [allocated, completedByMe, absentByMe, upcomingByMe] = await Promise.all([
            prisma.sessions.count({
                where: {
                    student_id:     studentId,
                    activity_id:    cycle.activity_id,
                    session_type:   "individual_coaching",
                    status:         { notIn: ["cancelled"] },
                    scheduled_date: { gte: cycle.cycle_start, lte: cycle.cycle_end },
                },
            }),
            prisma.sessions.count({
                where: {
                    student_id:      studentId,
                    professional_id: professionalId,
                    activity_id:     cycle.activity_id,
                    session_type:    "individual_coaching",
                    status:          "completed",
                    scheduled_date:  { gte: cycle.cycle_start, lte: cycle.cycle_end },
                },
            }),
            prisma.sessions.count({
                where: {
                    student_id:      studentId,
                    professional_id: professionalId,
                    activity_id:     cycle.activity_id,
                    session_type:    "individual_coaching",
                    status:          "absent",
                    scheduled_date:  { gte: cycle.cycle_start, lte: cycle.cycle_end },
                },
            }),
            prisma.sessions.count({
                where: {
                    student_id:      studentId,
                    professional_id: professionalId,
                    activity_id:     cycle.activity_id,
                    session_type:    "individual_coaching",
                    status:          "scheduled",
                    scheduled_date:  { gte: cycle.cycle_start, lte: cycle.cycle_end },
                },
            }),
        ]);

        const baseAmt = parseFloat(cycle.base_amount);
        const rate    = parseFloat(cycle.commission_rate) || commissionRate;
        const commAmt = baseAmt > 0 && allocated > 0
            ? parseFloat(((baseAmt * rate / 100) / allocated * completedByMe).toFixed(2))
            : 0;

        await prisma.ic_cycle_settlements.update({
            where: { id: cycle.id },
            data: {
                sessions_allocated: allocated,
                sessions_attended:  completedByMe,
                sessions_absent:    absentByMe,
                sessions_upcoming:  upcomingByMe,
                commission_rate:    rate,
                commission_amount:  commAmt,
            },
        });
    }
};

/**
 * GET IC settlement data for a trainer — structured as students[].cycles[].
 *
 * 1. Sync all pending cycles from live sessions.
 * 2. Load all IC participant records for this trainer with their cycle rows.
 * 3. Shape into nested response.
 *
 * @param {number} professionalId – trainer professionals.id
 */
exports.getICSettlement = async (professionalId) => {
    await exports.syncPendingCycles(professionalId);

    // Load cycles directly by professional_id so Trainer A still sees their cycles
    // even after individual_participants.trainer_professional_id moved to Trainer B.
    const cycles = await prisma.ic_cycle_settlements.findMany({
        where:   { professional_id: professionalId },
        orderBy: { cycle_start: "asc" },
        select: {
            id:                       true,
            individual_participant_id: true,
            activity_id:              true,
            cycle_start:              true,
            cycle_end:                true,
            sessions_allocated:       true,
            sessions_attended:        true,
            sessions_absent:          true,
            sessions_upcoming:        true,
            base_amount:              true,
            commission_rate:          true,
            commission_amount:        true,
            status:                   true,
            settled_at:               true,
            paid_at:                  true,
            activities:               { select: { id: true, name: true } },
            individual_participants: {
                select: {
                    id:                    true,
                    student_id:            true,
                    activity:              true,
                    term_months:           true,
                    membership_start_date: true,
                    membership_end_date:   true,
                    students: {
                        select: {
                            id:    true,
                            users: { select: { full_name: true, mobile: true, email: true, photo: true } },
                        },
                    },
                },
            },
        },
    });

    // Group by student (one IP record = one student, but may have partial + full cycles)
    const studentMap = {};
    for (const cycle of cycles) {
        const ip  = cycle.individual_participants;
        const sid = ip?.student_id;
        if (!sid) continue;

        if (!studentMap[sid]) {
            studentMap[sid] = {
                student_id:       sid,
                name:             ip.students?.users?.full_name ?? "—",
                mobile:           ip.students?.users?.mobile    ?? null,
                email:            ip.students?.users?.email     ?? null,
                photo:            ip.students?.users?.photo     ?? null,
                activity_name:    ip.activity ?? null,
                term_months:      ip.term_months,
                membership_start: ip.membership_start_date,
                membership_end:   ip.membership_end_date,
                cycles:           [],
            };
        }

        studentMap[sid].cycles.push({
            cycle_id:           cycle.id,
            activity_id:        cycle.activity_id,
            activity_name:      cycle.activities?.name ?? ip.activity ?? null,
            cycle_start:        cycle.cycle_start,
            cycle_end:          cycle.cycle_end,
            sessions_allocated: cycle.sessions_allocated,
            sessions_attended:  cycle.sessions_attended,
            sessions_absent:    cycle.sessions_absent,
            sessions_upcoming:  cycle.sessions_upcoming,
            base_amount:        parseFloat(cycle.base_amount),
            commission_rate:    parseFloat(cycle.commission_rate),
            commission_amount:  parseFloat(cycle.commission_amount),
            status:             cycle.status,
            settled_at:         cycle.settled_at,
            paid_at:            cycle.paid_at,
        });
    }

    return { success: true, professional_id: professionalId, students: Object.values(studentMap) };
};

/**
 * Settle a single IC cycle by its ID.
 * Marks settled, writes commissions record, credits wallet.
 *
 * @param {number} cycleId        – ic_cycle_settlements.id
 * @param {number} professionalId – trainer professionals.id (ownership check)
 */
exports.settleCycle = async (cycleId, professionalId) => {
    const cycle = await prisma.ic_cycle_settlements.findUnique({
        where:  { id: cycleId },
        select: {
            id:                       true,
            individual_participant_id: true,
            professional_id:          true,
            activity_id:              true,
            status:                   true,
            commission_amount:        true,
            base_amount:              true,
            commission_rate:          true,
        },
    });

    if (!cycle) throw Object.assign(new Error("IC cycle not found"), { statusCode: 404 });
    if (cycle.professional_id !== professionalId) {
        throw Object.assign(new Error("This cycle does not belong to this trainer"), { statusCode: 403 });
    }
    if (cycle.status !== "pending") {
        throw Object.assign(new Error(`Cycle is already ${cycle.status}`), { statusCode: 409 });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
        await tx.ic_cycle_settlements.update({
            where: { id: cycleId },
            data:  { status: "settled", settled_at: now },
        });

        await tx.commissions.create({
            data: {
                professional_id:   professionalId,
                professional_type: "trainer",
                source_type:       "individual_coaching",
                source_id:         cycle.individual_participant_id,
                entity_id:         cycle.activity_id,
                base_amount:       cycle.base_amount,
                commission_rate:   cycle.commission_rate,
                commission_amount: cycle.commission_amount,
                status:            "pending",
            },
        });

        await tx.wallets.upsert({
            where:  { professional_id: professionalId },
            update: { balance: { increment: parseFloat(cycle.commission_amount) }, updated_at: now },
            create: { professional_id: professionalId, balance: parseFloat(cycle.commission_amount) },
        });
    });

    return {
        success:           true,
        cycle_id:          cycleId,
        commission_amount: parseFloat(cycle.commission_amount),
        settled_at:        now,
    };
};

/**
 * Called when a trainer is reassigned mid-cycle (reassignAllFutureSessions).
 *
 * Finds the cycle row covering the reassignment date and creates a new cycle row
 * for the new trainer covering reassignDate → same cycle_end, using the same
 * sessions_allocated denominator as the original cycle (the student's full month).
 *
 * @param {number} ipId               – individual_participants.id
 * @param {number} newProfessionalId  – new trainer's professionals.id
 * @param {Date}   reassignDate       – date from which new trainer takes over
 */
exports.splitCycleOnReassignment = async (ipId, newProfessionalId, reassignDate) => {
    const ip = await prisma.individual_participants.findUnique({
        where:  { id: ipId },
        select: {
            student_id:  true,
            activity:    true,
            term_months: true,
            students:    { select: { user_id: true } },
        },
    });
    if (!ip || !ip.activity) return;

    const activity = await prisma.activities.findFirst({
        where:  { name: ip.activity.trim() },
        select: { id: true },
    });
    if (!activity) return;

    const reassign = new Date(reassignDate);
    reassign.setHours(0, 0, 0, 0);

    const commissionRate = await resolveCommissionRate();

    const existingCycle = await prisma.ic_cycle_settlements.findFirst({
        where: {
            individual_participant_id: ipId,
            activity_id:               activity.id,
            cycle_start:               { lte: reassign },
            cycle_end:                 { gte: reassign },
            status:                    "pending",
        },
    });
    if (!existingCycle) return;

    const em           = parseFloat(existingCycle.base_amount);
    const partialStart = reassign;
    const partialEnd   = existingCycle.cycle_end;
    const allocated    = existingCycle.sessions_allocated;

    await prisma.ic_cycle_settlements.upsert({
        where: {
            individual_participant_id_professional_id_activity_id_cycle_start: {
                individual_participant_id: ipId,
                professional_id:           newProfessionalId,
                activity_id:               activity.id,
                cycle_start:               partialStart,
            },
        },
        create: {
            individual_participant_id: ipId,
            professional_id:           newProfessionalId,
            activity_id:               activity.id,
            cycle_start:               partialStart,
            cycle_end:                 partialEnd,
            sessions_allocated:        allocated,
            sessions_attended:         0,
            sessions_absent:           0,
            sessions_upcoming:         0,
            base_amount:               em,
            commission_rate:           commissionRate,
            commission_amount:         0,
            status:                    "pending",
        },
        update: {
            cycle_end:          partialEnd,
            sessions_allocated: allocated,
            base_amount:        em,
            commission_rate:    commissionRate,
        },
    });

    await exports.syncPendingCycles(newProfessionalId);
};
