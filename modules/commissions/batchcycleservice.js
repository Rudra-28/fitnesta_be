"use strict";

/**
 * Batch Cycle Settlement Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides settlement GET endpoints for a trainer's group coaching:
 *   - Society batches  → GET /trainers/:id/society-settlement
 *   - School batches   → GET /trainers/:id/school-settlement
 *
 * All cycles are pre-created at batch creation time (createBatch now does this).
 * Pending cycles are live-synced from the sessions table on every GET.
 * Settled / paid cycles are frozen.
 *
 * Response shape (same for both types):
 *   {
 *     entities: [           ← societies[] or schools[]
 *       {
 *         id, name,
 *         activities: [
 *           {
 *             activity_id, activity_name,
 *             batches: [
 *               {
 *                 batch_id, batch_name,
 *                 cycles: [ { cycle_id, cycle_start, cycle_end, sessions_allocated,
 *                             sessions_attended, sessions_absent, sessions_upcoming,
 *                             base_amount, commission_rate, commission_amount,
 *                             status, settled_at, paid_at } ]
 *               }
 *             ]
 *           }
 *         ]
 *       }
 *     ]
 *   }
 */

const prisma = require("../../config/prisma");

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Live-sync all PENDING batch_cycle_settlements rows for a set of batch IDs.
 * Re-counts sessions (excluding cancelled) and recomputes commission amounts.
 * Settled / paid cycles are untouched.
 */
async function syncPendingBatchCycles(batchIds) {
    if (batchIds.length === 0) return;

    const pendingCycles = await prisma.batch_cycle_settlements.findMany({
        where:  { batch_id: { in: batchIds }, status: "pending" },
        select: {
            id:          true,
            batch_id:    true,
            cycle_start: true,
            cycle_end:   true,
            batches: {
                select: {
                    professional_id: true,
                    activity_id:     true,
                    batch_type:      true,
                    session_cap:     true,
                    batch_students:  { select: { student_id: true } },
                    societies:       { select: { society_category: true } },
                },
            },
        },
    });

    for (const cycle of pendingCycles) {
        const batch      = cycle.batches;
        const sessionType = batch.batch_type === "school_student" ? "school_student" : "group_coaching";

        // Count non-cancelled sessions in this cycle window (denominator)
        const [allocated, attended] = await Promise.all([
            prisma.sessions.count({
                where: {
                    batch_id:       cycle.batch_id,
                    session_type:   sessionType,
                    scheduled_date: { gte: cycle.cycle_start, lte: cycle.cycle_end },
                    status:         { notIn: ["cancelled"] },
                },
            }),
            prisma.sessions.count({
                where: {
                    batch_id:       cycle.batch_id,
                    session_type:   sessionType,
                    scheduled_date: { gte: cycle.cycle_start, lte: cycle.cycle_end },
                    status:         "completed",
                },
            }),
        ]);

        // Recompute base_amount: sum of effective monthly fees for all students in this batch
        const batchStudentIds = (batch.batch_students ?? []).map(bs => bs.student_id);
        let baseAmount = 0;

        if (batchStudentIds.length > 0) {
            if (batch.batch_type === "school_student") {
                for (const studentId of batchStudentIds) {
                    const student = await prisma.students.findUnique({
                        where:  { id: studentId },
                        select: {
                            school_students: { select: { term_months: true } },
                            users:           { select: { id: true } },
                        },
                    });
                    const userId     = student?.users?.id;
                    const termMonths = student?.school_students?.[0]?.term_months ?? 9;
                    if (!userId) continue;
                    const payment = await prisma.payments.findFirst({
                        where:   { student_user_id: userId, service_type: "school_student", status: "captured" },
                        orderBy: { captured_at: "desc" },
                        select:  { amount: true },
                    });
                    if (payment) baseAmount += parseFloat((parseFloat(payment.amount) / termMonths).toFixed(2));
                }
            } else {
                for (const studentId of batchStudentIds) {
                    const ip = await prisma.individual_participants.findFirst({
                        where:  { student_id: studentId, batch_id: cycle.batch_id },
                        select: { term_months: true },
                    });
                    const termMonths = ip?.term_months ?? 1;
                    const fs = await prisma.fee_structures.findFirst({
                        where: {
                            activity_id:      batch.activity_id,
                            coaching_type:    "group_coaching",
                            term_months:      termMonths,
                            society_category: batch.societies?.society_category ?? undefined,
                        },
                        select: { effective_monthly: true, total_fee: true },
                    });
                    if (fs) {
                        baseAmount += fs.effective_monthly
                            ? parseFloat(fs.effective_monthly)
                            : parseFloat(fs.total_fee);
                    }
                }
            }
        }

        // Commission rate
        const isSchool   = batch.batch_type === "school_student";
        const ruleKey    = isSchool ? "trainer_group_school_rate" : "trainer_group_society_rate";
        const rateRule   = await prisma.commission_rules.findUnique({ where: { rule_key: ruleKey } });
        const rate       = rateRule ? parseFloat(rateRule.value) : (isSchool ? 45 : 50);

        // Flat rate check for society (below min student threshold)
        let commissionAmount = 0;
        let isFlat = false;
        if (!isSchool) {
            const minRule = await prisma.commission_rules.findUnique({ where: { rule_key: "trainer_group_society_min_students" } });
            const minStudents = minRule ? parseFloat(minRule.value) : 10;
            if (batchStudentIds.length < minStudents) {
                isFlat = true;
                const flatRule = await prisma.commission_rules.findUnique({ where: { rule_key: "trainer_group_society_flat_amount" } });
                const flatPerSession = flatRule ? parseFloat(flatRule.value) : 300;
                commissionAmount = parseFloat((attended * flatPerSession).toFixed(2));
            }
        }
        if (!isFlat) {
            const totalPool      = parseFloat(((baseAmount * rate) / 100).toFixed(2));
            const effectiveCap   = allocated > 0 ? allocated : (batch.session_cap ?? 1);
            const perSessionRate = effectiveCap > 0 ? parseFloat((totalPool / effectiveCap).toFixed(2)) : 0;
            commissionAmount     = parseFloat((attended * perSessionRate).toFixed(2));
        }

        await prisma.batch_cycle_settlements.update({
            where: { id: cycle.id },
            data: {
                sessions_allocated: allocated,
                sessions_attended:  attended,
                base_amount:        parseFloat(baseAmount.toFixed(2)),
                commission_rate:    rate,
                commission_amount:  commissionAmount,
            },
        });
    }
}

/**
 * Shape batch_cycle_settlements rows into entities[].activities[].batches[].cycles[].
 *
 * @param {number}   professionalId
 * @param {"group_coaching"|"school_student"} batchType
 */
async function getSettlement(professionalId, batchType) {
    // Load all batches for this trainer + type with their cycle rows
    const batches = await prisma.batches.findMany({
        where: {
            professional_id: professionalId,
            batch_type:      batchType,
            is_active:       true,
        },
        select: {
            id:         true,
            batch_name: true,
            activity_id: true,
            society_id:  true,
            school_id:   true,
            activities: { select: { id: true, name: true } },
            societies:  { select: { id: true, society_name: true } },
            schools:    { select: { id: true, school_name: true } },
            batch_cycle_settlements: {
                orderBy: { cycle_start: "asc" },
                select: {
                    id:                 true,
                    cycle_start:        true,
                    cycle_end:          true,
                    sessions_allocated: true,
                    sessions_attended:  true,
                    base_amount:        true,
                    commission_rate:    true,
                    commission_amount:  true,
                    status:             true,
                    settled_at:         true,
                    paid_at:            true,
                },
            },
        },
    });

    if (batches.length === 0) {
        return { success: true, professional_id: professionalId, entities: [] };
    }

    // Live-sync pending cycles
    await syncPendingBatchCycles(batches.map(b => b.id));

    // Reload after sync to get updated amounts
    const refreshed = await prisma.batches.findMany({
        where: { id: { in: batches.map(b => b.id) } },
        select: {
            id:          true,
            batch_name:  true,
            activity_id: true,
            society_id:  true,
            school_id:   true,
            activities:  { select: { id: true, name: true } },
            societies:   { select: { id: true, society_name: true } },
            schools:     { select: { id: true, school_name: true } },
            batch_cycle_settlements: {
                orderBy: { cycle_start: "asc" },
                select: {
                    id:                 true,
                    cycle_start:        true,
                    cycle_end:          true,
                    sessions_allocated: true,
                    sessions_attended:  true,
                    base_amount:        true,
                    commission_rate:    true,
                    commission_amount:  true,
                    status:             true,
                    settled_at:         true,
                    paid_at:            true,
                },
            },
        },
    });

    // Compute sessions_upcoming for all pending cycles in one pass
    const allPendingCycles = refreshed.flatMap(b =>
        b.batch_cycle_settlements.filter(c => c.status === 'pending').map(c => ({
            id:         c.id,
            batch_id:   b.id,
            batch_type: b.batch_type,
            cycle_start: c.cycle_start,
            cycle_end:   c.cycle_end,
        }))
    );
    const upcomingMap = {};
    const today = new Date(); today.setHours(0,0,0,0);
    for (const c of allPendingCycles) {
        const sessionType = c.batch_type === 'school_student' ? 'school_student' : 'group_coaching';
        const count = await prisma.sessions.count({
            where: {
                batch_id:       c.batch_id,
                session_type:   sessionType,
                scheduled_date: { gte: today <= c.cycle_end ? today : c.cycle_start, lte: c.cycle_end },
                status:         'scheduled',
            },
        });
        upcomingMap[c.id] = count;
    }

    // Build nested map: entityId → activityId → batchId → cycles
    const entityMap = {};

    for (const batch of refreshed) {
        const entityId   = batchType === "group_coaching" ? batch.society_id : batch.school_id;
        const entityName = batchType === "group_coaching"
            ? (batch.societies?.society_name ?? "Unknown Society")
            : (batch.schools?.school_name   ?? "Unknown School");

        if (!entityMap[entityId]) {
            entityMap[entityId] = { id: entityId, name: entityName, activities: {} };
        }

        const actId   = batch.activity_id;
        const actName = batch.activities?.name ?? "Unknown";

        if (!entityMap[entityId].activities[actId]) {
            entityMap[entityId].activities[actId] = {
                activity_id:   actId,
                activity_name: actName,
                batches:       [],
            };
        }

        entityMap[entityId].activities[actId].batches.push({
            batch_id:   batch.id,
            batch_name: batch.batch_name ?? actName,
            cycles: batch.batch_cycle_settlements.map(c => ({
                cycle_id:           c.id,
                cycle_start:        c.cycle_start,
                cycle_end:          c.cycle_end,
                sessions_allocated: c.sessions_allocated,
                sessions_attended:  c.sessions_attended,
                sessions_upcoming:  upcomingMap[c.id] ?? 0,
                base_amount:        parseFloat(c.base_amount),
                commission_rate:    parseFloat(c.commission_rate),
                commission_amount:  parseFloat(c.commission_amount),
                status:             c.status,
                settled_at:         c.settled_at,
                paid_at:            c.paid_at,
            })),
        });
    }

    // Flatten maps → arrays
    const entities = Object.values(entityMap).map(e => ({
        ...e,
        activities: Object.values(e.activities),
    }));

    return { success: true, professional_id: professionalId, entities };
}

exports.getSocietySettlement = (professionalId) => getSettlement(professionalId, "group_coaching");
exports.getSchoolSettlement  = (professionalId) => getSettlement(professionalId, "school_student");
