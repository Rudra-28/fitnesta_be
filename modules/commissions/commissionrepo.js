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
    entityId = null,
    baseAmount,
    commissionRate,
    commissionAmount,
    status = "pending",
}) => {
    // Wallet is only credited when admin marks the commission as paid.
    // Do NOT credit wallet here regardless of status.
    await prisma.commissions.create({
        data: {
            professional_id:   professionalId,
            professional_type: professionalType,
            source_type:       sourceType,
            source_id:         sourceId,
            entity_id:         entityId,
            base_amount:       baseAmount,
            commission_rate:   commissionRate,
            commission_amount: commissionAmount,
            status,
        },
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

// ── ME Wallet Breakdown (rich, grouped) ───────────────────────────────────

/**
 * Rich ME wallet breakdown grouped by entity.
 *
 * pending bucket  → on_hold rows (group/school, threshold not met) + pending rows (individual/tutor)
 * approved bucket → approved rows
 * paid bucket     → paid rows
 *
 * Society/school groups show: entity name, student count, threshold, per-student items, onboarding item.
 * Individual/tutor rows show flat per-student items.
 */
exports.getMEWalletBreakdown = async (meProfessionalId, bucketStatus) => {
    const THRESHOLD = 20;

    const statusFilter = bucketStatus === "pending"
        ? { status: { in: ["on_hold", "pending"] } }
        : { status: bucketStatus };

    const rows = await prisma.commissions.findMany({
        where:   { professional_id: meProfessionalId, ...statusFilter },
        orderBy: { created_at: "asc" },
    });

    // ── Split rows by category ─────────────────────────────────────────────
    // Change these lines:
const groupRows = rows.filter(r => r.source_type === "group_coaching_society" && r.entity_id);

const schoolRows = rows.filter(r => 
    (r.source_type === "group_coaching_school" || r.source_type === "school_registration") 
    && r.entity_id
);
    const individualRows = rows.filter(r => r.source_type === "individual_coaching");
    const tutorRows      = rows.filter(r => r.source_type === "personal_tutor");

    // ── Resolve student user_ids for group/school admission rows ──────────
    // source_id on admission rows = student_user_id
    const admissionStudentIds = [
        ...groupRows.filter(r => r.base_amount > 0),
        ...schoolRows.filter(r => r.source_type === "group_coaching_school"),
    ].map(r => r.source_id);

    let studentNameMap = {};
    if (admissionStudentIds.length > 0) {
        const users = await prisma.users.findMany({
            where:  { id: { in: admissionStudentIds } },
            select: { id: true, full_name: true, mobile: true },
        });
        studentNameMap = Object.fromEntries(users.map(u => [u.id, u]));
    }

    // ── Resolve individual_coaching / personal_tutor student names ─────────
    const indStudentIds  = individualRows.map(r => r.source_id);
    const tutorStudentIds = tutorRows.map(r => r.source_id);
    const directStudentIds = [...new Set([...indStudentIds, ...tutorStudentIds])];
    let directStudentMap = {};
    if (directStudentIds.length > 0) {
        const users = await prisma.users.findMany({
            where:  { id: { in: directStudentIds } },
            select: { id: true, full_name: true, mobile: true },
        });
        directStudentMap = Object.fromEntries(users.map(u => [u.id, u]));
    }

    // ── Group society rows by entity_id ────────────────────────────────────
    const societyEntityIds = [...new Set(groupRows.map(r => r.entity_id).filter(Boolean))];
    let societyMap = {};
    if (societyEntityIds.length > 0) {
        const societies = await prisma.societies.findMany({
            where:  { id: { in: societyEntityIds } },
            select: { id: true, society_name: true },
        });
        societyMap = Object.fromEntries(societies.map(s => [s.id, s]));
    }

    // ── Group school rows by entity_id ─────────────────────────────────────
    const schoolEntityIds = [...new Set(schoolRows.map(r => r.entity_id).filter(Boolean))];
    let schoolMap = {};
    if (schoolEntityIds.length > 0) {
        const schools = await prisma.schools.findMany({
            where:  { id: { in: schoolEntityIds } },
            select: { id: true, school_name: true },
        });
        schoolMap = Object.fromEntries(schools.map(s => [s.id, s]));
    }

    // ── Build society groups ───────────────────────────────────────────────
    const societyGroups = [];
    for (const entityId of societyEntityIds) {
        const entityRows    = groupRows.filter(r => r.entity_id === entityId);
        // Inside the societyGroups loop:
        const onboarding = entityRows.find(r => 
        r.source_type === "group_coaching_society" && parseFloat(r.base_amount) === 0
        );
        const admissions    = entityRows.filter(r => parseFloat(r.base_amount) > 0);
        const studentCount  = await prisma.individual_participants.count({
            where: { society_id: entityId, students: { student_type: "group_coaching" } },
        });
        const totalHeld     = entityRows.reduce((s, r) => s + parseFloat(r.commission_amount), 0);

        societyGroups.push({
            entity_type:       "society",
            entity_id:         entityId,
            entity_name:       societyMap[entityId]?.society_name ?? null,
            students_enrolled: studentCount,
            threshold:         THRESHOLD,
            threshold_reached: studentCount >= THRESHOLD,
            total_amount:      parseFloat(totalHeld.toFixed(2)),
            onboarding: onboarding ? {
                commission_id:     onboarding.id,
                amount:            parseFloat(onboarding.commission_amount),
                status:            onboarding.status,
                created_at:        onboarding.created_at,
            } : null,
            admissions: admissions.map(r => ({
                commission_id:  r.id,
                student_user_id: r.source_id,
                student_name:   studentNameMap[r.source_id]?.full_name ?? null,
                student_mobile: studentNameMap[r.source_id]?.mobile ?? null,
                base_amount:    parseFloat(r.base_amount),
                rate:           parseFloat(r.commission_rate),
                amount:         parseFloat(r.commission_amount),
                status:         r.status,
                created_at:     r.created_at,
            })),
        });
    }

    // ── Build school groups ────────────────────────────────────────────────
    const schoolGroups = [];
    for (const entityId of schoolEntityIds) {
        const entityRows   = schoolRows.filter(r => r.entity_id === entityId);
       // Inside the schoolGroups loop:
        const onboarding = entityRows.find(r => r.source_type === "school_registration");
        const admissions = entityRows.filter(r => r.source_type === "group_coaching_school");
        const studentCount = await prisma.school_students.count({ where: { school_id: entityId } });
        const totalHeld    = entityRows.reduce((s, r) => s + parseFloat(r.commission_amount), 0);

        schoolGroups.push({
            entity_type:       "school",
            entity_id:         entityId,
            entity_name:       schoolMap[entityId]?.school_name ?? null,
            students_enrolled: studentCount,
            threshold:         THRESHOLD,
            threshold_reached: studentCount >= THRESHOLD,
            total_amount:      parseFloat(totalHeld.toFixed(2)),
            onboarding: onboarding ? {
                commission_id: onboarding.id,
                amount:        parseFloat(onboarding.commission_amount),
                status:        onboarding.status,
                created_at:    onboarding.created_at,
            } : null,
            admissions: admissions.map(r => ({
                commission_id:   r.id,
                student_user_id: r.source_id,
                student_name:    studentNameMap[r.source_id]?.full_name ?? null,
                student_mobile:  studentNameMap[r.source_id]?.mobile ?? null,
                base_amount:     parseFloat(r.base_amount),
                rate:            parseFloat(r.commission_rate),
                amount:          parseFloat(r.commission_amount),
                status:          r.status,
                created_at:      r.created_at,
            })),
        });
    }

    // ── Build individual / tutor flat rows ─────────────────────────────────
    const individualItems = individualRows.map(r => ({
        commission_id:   r.id,
        source_type:     "individual_coaching",
        student_user_id: r.source_id,
        student_name:    directStudentMap[r.source_id]?.full_name ?? null,
        student_mobile:  directStudentMap[r.source_id]?.mobile ?? null,
        base_amount:     parseFloat(r.base_amount),
        rate:            parseFloat(r.commission_rate),
        amount:          parseFloat(r.commission_amount),
        status:          r.status,
        created_at:      r.created_at,
    }));

    const tutorItems = tutorRows.map(r => ({
        commission_id:   r.id,
        source_type:     "personal_tutor",
        student_user_id: r.source_id,
        student_name:    directStudentMap[r.source_id]?.full_name ?? null,
        student_mobile:  directStudentMap[r.source_id]?.mobile ?? null,
        base_amount:     parseFloat(r.base_amount),
        rate:            parseFloat(r.commission_rate),
        amount:          parseFloat(r.commission_amount),
        status:          r.status,
        created_at:      r.created_at,
    }));

    // ── Totals ─────────────────────────────────────────────────────────────
    const totalSociety    = societyGroups.reduce((s, g) => s + g.total_amount, 0);
    const totalSchool     = schoolGroups.reduce((s, g) => s + g.total_amount, 0);
    const totalIndividual = individualItems.reduce((s, i) => s + i.amount, 0);
    const totalTutor      = tutorItems.reduce((s, i) => s + i.amount, 0);

    return {
        bucket:           bucketStatus,
        total:            parseFloat((totalSociety + totalSchool + totalIndividual + totalTutor).toFixed(2)),
        societies:        societyGroups,
        schools:          schoolGroups,
        individual_coaching: individualItems,
        personal_tutor:   tutorItems,
    };
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
    // Commission totals from the commissions table
    const rows = await prisma.commissions.groupBy({
        by:    ["status"],
        where: { professional_id: professionalId },
        _sum:  { commission_amount: true },
    });

    const byStatus = Object.fromEntries(
        rows.map((r) => [r.status, parseFloat(r._sum.commission_amount ?? 0)])
    );

    // Travelling allowance totals — merged into the same pending/paid buckets.
    // TA has no "approved" state; pending → paid directly via admin.
    const taRows = await prisma.travelling_allowances.groupBy({
        by:    ["status"],
        where: { trainer_professional_id: professionalId },
        _sum:  { amount: true },
    });

    const taByStatus = Object.fromEntries(
        taRows.map((r) => [r.status, parseFloat(r._sum.amount ?? 0)])
    );

    return {
        pending:  (byStatus.on_hold ?? 0) + (byStatus.pending ?? 0) + (taByStatus.pending ?? 0),
        approved:  byStatus.approved ?? 0,
        paid:     (byStatus.paid ?? 0) + (taByStatus.paid ?? 0),
    };
};

/**
 * Itemized commission rows for a professional filtered by wallet bucket.
 * For trainer/teacher source_types backed by trainer_assignments, joins assignment
 * to surface entity name, activity, assigned_from so the professional can see
 * exactly which posting the payment relates to.
 *
 * bucketStatus: 'pending' maps to on_hold + pending rows; 'approved' or 'paid' map directly.
 */
exports.getWalletBreakdown = async (professionalId, bucketStatus) => {
    const statusFilter =
        bucketStatus === "pending"
            ? { status: { in: ["on_hold", "pending"] } }
            : { status: bucketStatus };

    const rows = await prisma.commissions.findMany({
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

    // Append travelling allowance rows for the matching bucket.
    // TA only has "pending" and "paid" — no "approved" state.
    // Map each TA row to the same shape as a commissions row so the Flutter
    // wallet list renders it without any shape change.
    const taStatusFilter = bucketStatus === "pending" ? { status: "pending" }
                         : bucketStatus === "paid"    ? { status: "paid" }
                         : null; // "approved" bucket has no TA rows

    if (taStatusFilter) {
        const taRows = await prisma.travelling_allowances.findMany({
            where:   { trainer_professional_id: professionalId, ...taStatusFilter },
            select:  { id: true, allowance_date: true, batches_count: true, amount: true, status: true, created_at: true },
            orderBy: { allowance_date: "desc" },
        });

        for (const ta of taRows) {
            rows.push({
                id:                ta.id,
                source_type:       "travelling_allowance",   // existing recognised key in Flutter
                source_id:         ta.id,
                base_amount:       0,
                commission_rate:   0,
                commission_amount: parseFloat(ta.amount),
                status:            ta.status,                // "pending" | "paid" — same as commissions
                created_at:        ta.created_at ?? ta.allowance_date,
                // extra context fields — Flutter ignores unknown fields safely
                _ta_date:          ta.allowance_date,
                _ta_batches:       ta.batches_count,
            });
        }

        // Re-sort combined list by date descending
        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // Enrich rows that reference a trainer_assignment (source_id = assignment id)
    const assignmentSourceTypes = new Set([
        "group_coaching_society", "group_coaching_school",
        "individual_coaching", "personal_tutor",
    ]);

    const assignmentIds = rows
        .filter((r) => assignmentSourceTypes.has(r.source_type))
        .map((r) => r.source_id);

    const kitOrderIds = rows
        .filter((r) => r.source_type === "kit_order")
        .map((r) => r.source_id);

    let assignmentMap = {};
    if (assignmentIds.length > 0) {
        const assignments = await prisma.trainer_assignments.findMany({
            where:   { id: { in: assignmentIds } },
            select: {
                id:             true,
                assignment_type: true,
                assigned_from:  true,
                sessions_allocated: true,
                societies:      { select: { society_name: true } },
                schools:        { select: { school_name: true } },
                activities:     { select: { name: true } },
            },
        });
        assignmentMap = Object.fromEntries(assignments.map((a) => [a.id, a]));
    }

    let kitOrderMap = {};
    if (kitOrderIds.length > 0) {
        const kitOrders = await prisma.kit_orders.findMany({
            where:  { id: { in: kitOrderIds } },
            select: {
                id:           true,
                total_amount: true,
                unit_price:   true,
                delivery_charge: true,
                quantity:     true,
                order_status: true,
                created_at:   true,
                vendor_products: { select: { product_name: true } },
                users:        { select: { full_name: true } },
            },
        });
        kitOrderMap = Object.fromEntries(kitOrders.map((o) => [o.id, o]));
    }

    return rows.map((r) => {
        const assignment = assignmentSourceTypes.has(r.source_type)
            ? assignmentMap[r.source_id] ?? null
            : null;
        const kitOrder = r.source_type === "kit_order"
            ? kitOrderMap[r.source_id] ?? null
            : null;
        return {
            id:                parseFloat(r.id),
            source_type:       r.source_type,
            source_id:         r.source_id,
            base_amount:       parseFloat(r.base_amount),
            commission_rate:   parseFloat(r.commission_rate),
            commission_amount: parseFloat(r.commission_amount),
            status:            r.status,
            created_at:        r.created_at,
            assignment: assignment ? {
                entity_name:        assignment.societies?.society_name
                                 ?? assignment.schools?.school_name
                                 ?? null,
                activity_name:      assignment.activities?.name ?? null,
                assigned_from:      assignment.assigned_from,
                sessions_allocated: assignment.sessions_allocated,
            } : null,
            kit_order: kitOrder ? {
                order_id:       kitOrder.id,
                product_name:   kitOrder.vendor_products?.product_name ?? null,
                customer_name:  kitOrder.users?.full_name ?? null,
                quantity:       kitOrder.quantity,
                unit_price:     parseFloat(kitOrder.unit_price),
                delivery_charge: parseFloat(kitOrder.delivery_charge),
                total_amount:   parseFloat(kitOrder.total_amount),
                order_status:   kitOrder.order_status,
                ordered_at:     kitOrder.created_at,
            } : null,
        };
    });
};

/**
 * Full transaction history for a professional.
 * Optional filters: status, source_type, page, limit.
 */
exports.getTransactionHistory = async (professionalId, { status, source_type, page = 1, limit = 20 } = {}) => {
    const statusFilter = status === "pending"
        ? { status: { in: ["on_hold", "pending"] } }
        : status ? { status } : {};

    const where = {
        professional_id: professionalId,
        ...statusFilter,
        ...(source_type && { source_type }),
    };

    // Fetch all matching commission rows (no pagination yet — we merge with TA first)
    const commissionRows = await prisma.commissions.findMany({
        where,
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

    // Include TA rows unless caller is explicitly filtering by a different source_type.
    // TA has no "approved" status so skip that bucket.
    const includeTa = !source_type || source_type === "travelling_allowance";
    const taStatusMap = { pending: "pending", paid: "paid" };
    const taStatus    = status ? taStatusMap[status] : null; // null = all

    let taRows = [];
    if (includeTa && status !== "approved") {
        const taWhere = {
            trainer_professional_id: professionalId,
            ...(taStatus ? { status: taStatus } : {}),
        };
        const rawTa = await prisma.travelling_allowances.findMany({
            where:   taWhere,
            select:  { id: true, allowance_date: true, batches_count: true, amount: true, status: true, created_at: true },
            orderBy: { allowance_date: "desc" },
        });

        taRows = rawTa.map((ta) => ({
            id:                ta.id,
            source_type:       "travelling_allowance",
            source_id:         ta.id,
            base_amount:       0,
            commission_rate:   0,
            commission_amount: parseFloat(ta.amount),
            status:            ta.status,
            created_at:        ta.created_at ?? ta.allowance_date,
            _ta_date:          ta.allowance_date,
            _ta_batches:       ta.batches_count,
        }));
    }

    // Merge, sort by date desc, paginate
    const all     = [...commissionRows, ...taRows]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total      = all.length;
    const skip       = (page - 1) * limit;
    const paginated  = all.slice(skip, skip + limit);

    return {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        transactions: paginated,
    };
};



/**
 * Release ALL on_hold commissions for an ME + entity (society or school).
 * This includes both:
 *   - per-admission commissions (source_type = group_coaching_society / group_coaching_school)
 *   - onboarding commission     (source_type = group_coaching_society / school_registration)
 * Both share the same entity_id, so a single query covers everything.
 *
 * Moves on_hold → pending. Wallet is credited only when admin marks paid.
 */
exports.releaseHeldCommissions = async (meProfessionalId, entityId) => {
    const held = await prisma.commissions.findMany({
        where: {
            professional_id: meProfessionalId,
            entity_id:       entityId,
            status:          "on_hold",
        },
        select: { id: true },
    });

    if (held.length === 0) return 0;

    const ids = held.map((c) => c.id);

    await prisma.commissions.updateMany({
        where: { id: { in: ids } },
        data:  { status: "pending" },
    });

    return held.length;
};
