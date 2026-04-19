/**
 * PT Cycle Settlement Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages per-month settlement cycles for personal_tutor students.
 *
 * A cycle row = one calendar month of sessions for one student × one activity.
 * Rows are pre-created when bulk sessions are generated (generateIndividualSessions).
 * Pending cycles are live-synced from the sessions table on every GET.
 * Settled / paid cycles are frozen.
 *
 * Table: pt_cycle_settlements
 *   personal_tutor_id  → personal_tutors.id
 *   activity_id        → activities.id  (resolved from teacher_for names at creation)
 *   cycle_start / cycle_end  – exact month window (start = membership_start + m months)
 */

"use strict";

const prisma = require("../../config/prisma");

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the N cycle date ranges from a membership start date.
 * Cycle m (0-indexed):
 *   start = membership_start + m months
 *   end   = start + 1 month − 1 day
 */
function buildCycleWindows(membershipStart, termMonths) {
    // Work entirely in UTC-midnight dates to avoid timezone shifts.
    // membershipStart may arrive as a Date with time components — strip them.
    const base = new Date(membershipStart);
    const baseY = base.getUTCFullYear();
    const baseM = base.getUTCMonth();
    const baseD = base.getUTCDate();

    const windows = [];
    for (let m = 0; m < termMonths; m++) {
        // cycle start: base date + m months (UTC midnight)
        const cycleStart = new Date(Date.UTC(baseY, baseM + m, baseD));

        // cycle end: one month later − 1 day (UTC midnight, then set to end-of-day for queries)
        const cycleEnd = new Date(Date.UTC(baseY, baseM + m + 1, baseD - 1, 23, 59, 59, 999));

        windows.push({ cycleStart, cycleEnd });
    }
    return windows;
}

/**
 * Fetch commission rate for a teacher (personal_tutor_rate rule).
 */
async function resolveCommissionRate() {
    const rule = await prisma.commission_rules.findUnique({
        where: { rule_key: "teacher_personal_tutor_rate" },
    });
    return rule ? parseFloat(rule.value) : 80;
}

/**
 * Resolve effective monthly fee for one activity for a student.
 *
 * Rule: commission is always calculated on the per-month portion of the fee.
 *   effective_monthly = total_fee ÷ term_months
 *
 * Lookup order:
 *   1. fee_structures row matching this activity + personal_tutor + student's term_months
 *      → use effective_monthly if stored, else total_fee ÷ term_months
 *   2. Any fee_structures row for this activity + personal_tutor (any term)
 *      → always divide that row's total_fee by the STUDENT's actual term_months
 *   3. Latest successful payment for this user ÷ term_months
 */
async function resolveEffectiveMonthly(userId, activityId, termMonths) {
    const resolvedTerm = termMonths ?? 1;

    // 1. Exact term match
    const exact = await prisma.fee_structures.findFirst({
        where: {
            activity_id:   activityId,
            coaching_type: "personal_tutor",
            term_months:   resolvedTerm,
        },
        select: { effective_monthly: true, total_fee: true, term_months: true },
    });
    if (exact) {
        // effective_monthly already accounts for the term division if set
        if (exact.effective_monthly) return parseFloat(exact.effective_monthly);
        // Otherwise derive it: total ÷ student's term (not the row's term — same here since exact match)
        return parseFloat(exact.total_fee) / resolvedTerm;
    }

    // 2. Any row for this activity — divide total_fee by student's actual term
    const any = await prisma.fee_structures.findFirst({
        where: {
            activity_id:   activityId,
            coaching_type: "personal_tutor",
        },
        orderBy: { term_months: "desc" }, // prefer longer-term rows as closer proxy
        select: { effective_monthly: true, total_fee: true, term_months: true },
    });
    if (any) {
        // Always divide by the student's own term_months so the per-month base is correct.
        // e.g. 6-month total=7200 → 7200/6=1200/month, even if only a 1-month row exists (8500/6≈1417).
        if (any.effective_monthly) return parseFloat(any.effective_monthly);
        return parseFloat(any.total_fee) / resolvedTerm;
    }

    // 3. Payment fallback ÷ term
    const payment = await prisma.payments.findFirst({
        where:   { user_id: userId, status: "success" },
        orderBy: { created_at: "desc" },
        select:  { amount: true },
    });
    return payment ? parseFloat(payment.amount) / resolvedTerm : 0;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Pre-create cycle rows for a personal_tutor record after bulk session generation.
 *
 * Called from generateIndividualSessions immediately after sessions are written.
 *
 * @param {number} personalTutorId   – personal_tutors.id
 * @param {Date}   membershipStart   – first cycle start date
 * @param {number} termMonths        – total number of monthly cycles
 * @param {number} professionalId    – teacher's professionals.id
 */
exports.createCyclesForPT = async (personalTutorId, membershipStart, termMonths, professionalId) => {
    // Load the PT record to get student + activity names
    const pt = await prisma.personal_tutors.findUnique({
        where:  { id: personalTutorId },
        select: {
            student_id:  true,
            teacher_for: true,
            term_months: true,
            students: { select: { user_id: true } },
        },
    });
    if (!pt) return;

    const userId       = pt.students?.user_id;
    const subjectNames = (pt.teacher_for || "")
        .split(",").map((s) => s.trim()).filter(Boolean);

    // Resolve activity IDs for all subjects in teacher_for
    const activities = subjectNames.length > 0
        ? await prisma.activities.findMany({
            where:  { name: { in: subjectNames } },
            select: { id: true, name: true },
          })
        : [];

    if (activities.length === 0) return; // nothing to track without activity mapping

    const commissionRate = await resolveCommissionRate();
    const windows        = buildCycleWindows(membershipStart, termMonths);

    for (const activity of activities) {
        const em = await resolveEffectiveMonthly(userId, activity.id, termMonths);

        for (const { cycleStart, cycleEnd } of windows) {
            // Count sessions in this cycle window for this student + professional + activity
            const [completed, absent, upcoming] = await Promise.all([
                prisma.sessions.count({
                    where: {
                        student_id:      pt.student_id,
                        professional_id: professionalId,
                        activity_id:     activity.id,
                        session_type:    "personal_tutor",
                        status:          "completed",
                        scheduled_date:  { gte: cycleStart, lte: cycleEnd },
                    },
                }),
                prisma.sessions.count({
                    where: {
                        student_id:      pt.student_id,
                        professional_id: professionalId,
                        activity_id:     activity.id,
                        session_type:    "personal_tutor",
                        status:          "absent",
                        scheduled_date:  { gte: cycleStart, lte: cycleEnd },
                    },
                }),
                prisma.sessions.count({
                    where: {
                        student_id:      pt.student_id,
                        professional_id: professionalId,
                        activity_id:     activity.id,
                        session_type:    "personal_tutor",
                        status:          "scheduled",
                        scheduled_date:  { gte: cycleStart, lte: cycleEnd },
                    },
                }),
            ]);

            const allocated       = completed + absent + upcoming;
            const commissionAmt   = em > 0
                ? parseFloat(((em * commissionRate / 100) / Math.max(allocated, 1) * completed).toFixed(2))
                : 0;

            await prisma.pt_cycle_settlements.upsert({
                where: {
                    personal_tutor_id_activity_id_cycle_start: {
                        personal_tutor_id: personalTutorId,
                        activity_id:       activity.id,
                        cycle_start:       cycleStart,
                    },
                },
                create: {
                    personal_tutor_id:  personalTutorId,
                    activity_id:        activity.id,
                    cycle_start:        cycleStart,
                    cycle_end:          cycleEnd,
                    sessions_allocated: allocated,
                    sessions_attended:  completed,
                    sessions_absent:    absent,
                    sessions_upcoming:  upcoming,
                    base_amount:        em,
                    commission_rate:    commissionRate,
                    commission_amount:  commissionAmt,
                    status:             "pending",
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
    }
};

/**
 * Live-sync all PENDING cycle rows for a teacher.
 * Re-counts sessions from the live sessions table and updates amounts.
 * Settled / paid cycles are left untouched.
 *
 * @param {number} professionalId  – teacher professionals.id
 */
exports.syncPendingCycles = async (professionalId) => {
    // Find all PT records for this teacher
    const ptRecords = await prisma.personal_tutors.findMany({
        where:  { teacher_professional_id: professionalId },
        select: { id: true, student_id: true, term_months: true, students: { select: { user_id: true } } },
    });
    if (ptRecords.length === 0) return;

    const ptIds = ptRecords.map((p) => p.id);
    const ptMap = Object.fromEntries(ptRecords.map((p) => [p.id, p]));

    // Load all pending cycles for these PT records
    const pendingCycles = await prisma.pt_cycle_settlements.findMany({
        where:  { personal_tutor_id: { in: ptIds }, status: "pending" },
        select: {
            id: true, personal_tutor_id: true, activity_id: true,
            cycle_start: true, cycle_end: true, base_amount: true, commission_rate: true,
        },
    });

    const commissionRate = await resolveCommissionRate();

    for (const cycle of pendingCycles) {
        const pt        = ptMap[cycle.personal_tutor_id];
        const studentId = pt?.student_id;
        if (!studentId) continue;

        const [completed, absent, upcoming] = await Promise.all([
            prisma.sessions.count({
                where: {
                    student_id:      studentId,
                    professional_id: professionalId,
                    activity_id:     cycle.activity_id,
                    session_type:    "personal_tutor",
                    status:          "completed",
                    scheduled_date:  { gte: cycle.cycle_start, lte: cycle.cycle_end },
                },
            }),
            prisma.sessions.count({
                where: {
                    student_id:      studentId,
                    professional_id: professionalId,
                    activity_id:     cycle.activity_id,
                    session_type:    "personal_tutor",
                    status:          "absent",
                    scheduled_date:  { gte: cycle.cycle_start, lte: cycle.cycle_end },
                },
            }),
            prisma.sessions.count({
                where: {
                    student_id:      studentId,
                    professional_id: professionalId,
                    activity_id:     cycle.activity_id,
                    session_type:    "personal_tutor",
                    status:          "scheduled",
                    scheduled_date:  { gte: cycle.cycle_start, lte: cycle.cycle_end },
                },
            }),
        ]);

        const allocated     = completed + absent + upcoming;
        const baseAmt       = parseFloat(cycle.base_amount);
        const rate          = parseFloat(cycle.commission_rate) || commissionRate;
        const commissionAmt = baseAmt > 0
            ? parseFloat(((baseAmt * rate / 100) / Math.max(allocated, 1) * completed).toFixed(2))
            : 0;

        await prisma.pt_cycle_settlements.update({
            where: { id: cycle.id },
            data: {
                sessions_allocated: allocated,
                sessions_attended:  completed,
                sessions_absent:    absent,
                sessions_upcoming:  upcoming,
                commission_rate:    rate,
                commission_amount:  commissionAmt,
            },
        });
    }
};

/**
 * GET settlement data for a teacher — structured as students[].activities[].cycles[].
 *
 * 1. Sync all pending cycles from live sessions.
 * 2. Load all PT records for this teacher with their cycle rows.
 * 3. Shape into nested response.
 *
 * @param {number} professionalId  – teacher professionals.id
 */
exports.getPTSettlement = async (professionalId) => {
    // Step 1: live-sync
    await exports.syncPendingCycles(professionalId);

    // Step 2: load PT records with cycles and activity info
    const ptRecords = await prisma.personal_tutors.findMany({
        where: { teacher_professional_id: professionalId },
        select: {
            id:          true,
            student_id:  true,
            teacher_for: true,
            term_months: true,
            membership_start_date: true,
            membership_end_date:   true,
            students: {
                select: {
                    id: true,
                    users: { select: { full_name: true, mobile: true, email: true, photo: true } },
                },
            },
            pt_cycle_settlements: {
                orderBy: { cycle_start: "asc" },
                select: {
                    id:                 true,
                    activity_id:        true,
                    cycle_start:        true,
                    cycle_end:          true,
                    sessions_allocated: true,
                    sessions_attended:  true,
                    sessions_absent:    true,
                    sessions_upcoming:  true,
                    base_amount:        true,
                    commission_rate:    true,
                    commission_amount:  true,
                    status:             true,
                    settled_at:         true,
                    paid_at:            true,
                    activities: { select: { id: true, name: true } },
                },
            },
        },
    });

    // Step 3: group by student → activity → cycles
    // One PT record = one student, but a student can have multiple activity rows in pt_cycle_settlements
    const studentMap = {};

    for (const pt of ptRecords) {
        const sid = pt.student_id;
        if (!studentMap[sid]) {
            studentMap[sid] = {
                student_id:    sid,
                name:          pt.students?.users?.full_name ?? "—",
                mobile:        pt.students?.users?.mobile ?? null,
                email:         pt.students?.users?.email ?? null,
                photo:         pt.students?.users?.photo ?? null,
                activities:    {},
            };
        }

        // Group cycles by activity
        for (const cycle of pt.pt_cycle_settlements) {
            const actId   = cycle.activity_id;
            const actName = cycle.activities?.name ?? "Unknown";

            if (!studentMap[sid].activities[actId]) {
                studentMap[sid].activities[actId] = {
                    activity_id:       actId,
                    activity_name:     actName,
                    personal_tutor_id: pt.id,
                    term_months:       pt.term_months,
                    membership_start:  pt.membership_start_date,
                    membership_end:    pt.membership_end_date,
                    cycles:            [],
                };
            }

            studentMap[sid].activities[actId].cycles.push({
                cycle_id:           cycle.id,
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
    }

    // Flatten activities map → array
    const students = Object.values(studentMap).map((s) => ({
        ...s,
        activities: Object.values(s.activities),
    }));

    return { success: true, professional_id: professionalId, students };
};

/**
 * Settle a single cycle by its ID.
 * - Marks status = 'settled', sets settled_at.
 * - Creates a commissions record (status = pending, awaiting payout approval).
 * - Credits teacher wallet.
 *
 * @param {number} cycleId       – pt_cycle_settlements.id
 * @param {number} professionalId – teacher professionals.id (for ownership check)
 */
exports.settleCycle = async (cycleId, professionalId) => {
    const cycle = await prisma.pt_cycle_settlements.findUnique({
        where:  { id: cycleId },
        select: {
            id:               true,
            personal_tutor_id: true,
            activity_id:      true,
            status:           true,
            sessions_attended: true,
            base_amount:      true,
            commission_rate:  true,
            commission_amount: true,
            personal_tutors: {
                select: { teacher_professional_id: true },
            },
        },
    });

    if (!cycle) throw Object.assign(new Error("Cycle not found"), { statusCode: 404 });
    if (cycle.personal_tutors?.teacher_professional_id !== professionalId) {
        throw Object.assign(new Error("This cycle does not belong to this teacher"), { statusCode: 403 });
    }
    if (cycle.status !== "pending") {
        throw Object.assign(new Error(`Cycle is already ${cycle.status}`), { statusCode: 409 });
    }

    const now = new Date();

    // Run in a transaction: update cycle + create commission + update wallet
    await prisma.$transaction(async (tx) => {
        // 1. Mark cycle settled
        await tx.pt_cycle_settlements.update({
            where: { id: cycleId },
            data:  { status: "settled", settled_at: now },
        });

        // 2. Commission record
        await tx.commissions.create({
            data: {
                professional_id:   professionalId,
                professional_type: "teacher",
                source_type:       "personal_tutor",
                source_id:         cycle.personal_tutor_id,
                entity_id:         cycle.activity_id,
                base_amount:       cycle.base_amount,
                commission_rate:   cycle.commission_rate,
                commission_amount: cycle.commission_amount,
                status:            "pending",
            },
        });

        // 3. Wallet credit — upsert so we handle first-time wallet creation
        await tx.wallets.upsert({
            where: { professional_id: professionalId },
            update: {
                balance:    { increment: parseFloat(cycle.commission_amount) },
                updated_at: now,
            },
            create: {
                professional_id: professionalId,
                balance:         parseFloat(cycle.commission_amount),
            },
        });
    });

    return {
        success:          true,
        cycle_id:         cycleId,
        commission_amount: parseFloat(cycle.commission_amount),
        settled_at:       now,
    };
};
