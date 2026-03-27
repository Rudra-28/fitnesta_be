const repo = require("./activitiesrepository");

const VALID_COACHING_TYPES = ["individual_coaching", "group_coaching", "personal_tutor"];

// school_student is an alias — the activities come from individual_coaching fees
const ALIAS_MAP = {
    school_student: "individual_coaching",
};

exports.getActivities = async (coachingType) => {
    // No coaching_type → return plain activity list
    if (!coachingType) {
        const activities = await repo.getAllActiveActivities();
        return { activities };
    }

    const resolved = ALIAS_MAP[coachingType] ?? coachingType;

    if (!VALID_COACHING_TYPES.includes(resolved)) {
        const err = new Error(
            `Invalid coaching_type. Allowed values: individual_coaching, group_coaching, personal_tutor, school_student`
        );
        err.status = 400;
        throw err;
    }

    const rows = await repo.getActivitiesByCoachingType(resolved);

    // Group flat rows into activity objects
    const activityMap = new Map();

    for (const row of rows) {
        if (!activityMap.has(row.id)) {
            activityMap.set(row.id, {
                id: row.id,
                name: row.name,
                notes: row.notes ?? null,
                fees: [],
            });
        }

        const feeEntry = {
            term_months: row.term_months,
            total_fee: parseFloat(row.total_fee),
        };

        if (row.effective_monthly !== null) {
            feeEntry.effective_monthly = parseFloat(row.effective_monthly);
        }
        if (row.society_category !== null) {
            feeEntry.society_category = row.society_category;
        }
        if (row.standard !== null) {
            feeEntry.standard = row.standard;
        }

        activityMap.get(row.id).fees.push(feeEntry);
    }

    return {
        coaching_type: coachingType,       // return what the client sent (e.g. school_student)
        activities: Array.from(activityMap.values()),
    };
};
