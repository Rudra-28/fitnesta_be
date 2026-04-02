const prisma = require("../../config/prisma");

/**
 * Fetch active activities with their fee structures for a given coaching type.
 * Optionally filter by society_category (A+, A, B) — relevant for group_coaching.
 */
exports.getActivitiesByCoachingType = async (coachingType, societyCategory = null, standard = null, termMonths = null) => {
    const feeFilter = {
        coaching_type: coachingType,
        ...(societyCategory && { society_category: societyCategory }),
        ...(standard        && { standard }),
        ...(termMonths      && { term_months: termMonths }),
    };

    const where = {
        is_active: true,
        fee_structures: { some: feeFilter },
    };

    const activities = await prisma.activities.findMany({
        where,
        include: {
            fee_structures: {
                where: feeFilter,
                select: {
                    society_category: true,
                    standard: true,
                    term_months: true,
                    total_fee: true,
                    effective_monthly: true,
                },
                orderBy: [
                    { society_category: "asc" },
                    { standard: "asc" },
                    { term_months: "asc" },
                ],
            },
        },
        orderBy: { id: "asc" },
    });

    return activities;
};

/**
 * Fetch all active activities (no fee data).
 */
exports.getAllActiveActivities = async () => {
    return await prisma.activities.findMany({
        where: { is_active: true },
        select: { id: true, name: true, notes: true },
        orderBy: { id: "asc" },
    });
};

/**
 * Look up the fee for a single activity.
 * Used by individual_coaching, group_coaching, and school_student flows.
 * @param {number} activityId
 * @param {string} coachingType  - 'individual_coaching' | 'group_coaching' | 'school_student'
 * @param {number} termMonths    - 1 | 3 | 6 | 9
 * @returns {{ total_fee: Decimal } | null}
 */
exports.getFeeForActivity = async (activityId, coachingType, termMonths, societyCategory = null) => {
    return await prisma.fee_structures.findFirst({
        where: {
            activity_id: activityId,
            coaching_type: coachingType,
            term_months: termMonths,
            ...(societyCategory && { society_category: societyCategory }),
        },
        select: { total_fee: true },
    });
};

/**
 * Look up fees for multiple activities at once (personal tutor multi-subject).
 * @param {number[]} activityIds
 * @param {string}   coachingType - 'personal_tutor'
 * @param {number}   termMonths   - 1 | 3
 * @param {string}   standard     - e.g. '8TH-10TH'
 * @returns {Array<{ activity_id: number, total_fee: Decimal }>}
 */
exports.getFeesForActivities = async (activityIds, coachingType, termMonths, standard) => {
    return await prisma.fee_structures.findMany({
        where: {
            activity_id: { in: activityIds },
            coaching_type: coachingType,
            term_months: termMonths,
            standard,
        },
        select: { activity_id: true, total_fee: true },
    });
};
