const prisma = require("../../config/prisma");

/**
 * Fetch active activities with their fee structures for a given coaching type.
 * Optionally filter by society_category (A+, A, B) — relevant for group_coaching.
 */
exports.getActivitiesByCoachingType = async (coachingType, societyCategory = null, standard = null, termMonths = null, customCategoryName = null) => {
    const feeFilter = {
        coaching_type: coachingType,
        ...(societyCategory    && { society_category:     societyCategory    }),
        ...(customCategoryName && { custom_category_name: customCategoryName }),
        ...(standard           && { standard }),
        ...(termMonths         && { term_months: termMonths }),
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
                    custom_category_name: true,
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
        select: { id: true, name: true, notes: true, activity_category: true, image_url: true },
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
 * @param {string}   coachingType - 'personal_tutor' | 'group_coaching' | 'individual_coaching'
 * @param {number}   termMonths   - 1 | 3 | 6 | 9
 * @param {string}   societyCategory - 'A_' | 'A' | 'B'
 * @param {string}   standard     - e.g. '8TH-10TH'
 * @returns {Array<{ activity_id: number, total_fee: Decimal }>}
 */
/**
 * Fetch activity names by IDs. Used for building receipt line items.
 * @param {number[]} activityIds
 */
exports.getActivitiesByIds = async (activityIds) => {
    return await prisma.activities.findMany({
        where: { id: { in: activityIds } },
        select: { id: true, name: true },
    });
};

/**
 * Fetch distinct non-null standards for personal_tutor from fee_structures.
 * @returns {string[]}
 */
exports.getPersonalTutorStandards = async () => {
    const rows = await require("../../config/prisma").fee_structures.findMany({
        where: {
            coaching_type: "personal_tutor",
            standard: { not: null },
        },
        select: { standard: true },
        distinct: ["standard"],
        orderBy: { standard: "asc" },
    });
    return rows.map((r) => r.standard);
};

exports.getFeesForActivities = async (activityIds, coachingType, termMonths, societyCategory = null, standard = null) => {
    return await prisma.fee_structures.findMany({
        where: {
            activity_id: { in: activityIds },
            coaching_type: coachingType,
            term_months: termMonths,
            ...(societyCategory != null ? { society_category: societyCategory } : {}),
            ...(standard != null ? { standard } : {}),
        },
        select: { activity_id: true, total_fee: true },
    });
};
