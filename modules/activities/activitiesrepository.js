const db = require("../../config/db");

/**
 * Fetch active activities with their fee structures for a given coaching type.
 * For school_student, we alias to individual_coaching since no separate fee rows exist.
 */
exports.getActivitiesByCoachingType = async (coachingType) => {
    const [rows] = await db.execute(
        `SELECT
            a.id,
            a.name,
            a.notes,
            f.society_category,
            f.standard,
            f.term_months,
            f.total_fee,
            f.effective_monthly
         FROM activities a
         JOIN fee_structures f ON f.activity_id = a.id
         WHERE a.is_active = 1
           AND f.coaching_type = ?
         ORDER BY a.id, f.society_category, f.standard, f.term_months`,
        [coachingType]
    );
    return rows;
};

/**
 * Fetch all active activities (no fee data).
 */
exports.getAllActiveActivities = async () => {
    const [rows] = await db.execute(
        `SELECT id, name, notes FROM activities WHERE is_active = 1 ORDER BY id`
    );
    return rows;
};
