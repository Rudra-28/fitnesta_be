const repo = require("./activitiesrepository");

const VALID_COACHING_TYPES = ["individual_coaching", "group_coaching", "personal_tutor", "school_student"];
const VALID_SOCIETY_CATEGORIES = ["A+", "A", "B"];
const VALID_STANDARDS = ["1ST-2ND", "3RD-4TH", "5TH-6TH", "7TH-8TH", "8TH-10TH", "ANY"];

const ALIAS_MAP = {};

// Prisma maps the "A+" enum value to "A_" internally — convert back for API responses
const SOCIETY_CATEGORY_DISPLAY = {
    A_: "A+",
    A:  "A",
    B:  "B",
};

exports.getActivities = async (coachingType, societyCategory = null, standard = null, termMonths = null) => {
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

    if (societyCategory) {
        if (resolved !== "group_coaching") {
            const err = new Error("society_category filter is only applicable for group_coaching.");
            err.status = 400;
            throw err;
        }
        if (!VALID_SOCIETY_CATEGORIES.includes(societyCategory)) {
            const err = new Error(`Invalid society_category. Allowed values: A+, A, B`);
            err.status = 400;
            throw err;
        }
    }

    if (resolved === "personal_tutor") {
        if (!standard) {
            const err = new Error(`standard is required for personal_tutor. Allowed values: ${VALID_STANDARDS.join(", ")}`);
            err.status = 400;
            throw err;
        }
        if (!VALID_STANDARDS.includes(standard)) {
            const err = new Error(`Invalid standard. Allowed values: ${VALID_STANDARDS.join(", ")}`);
            err.status = 400;
            throw err;
        }
    }

    // Convert "A+" → "A_" for Prisma enum lookup
    const prismaCategory = societyCategory === "A+" ? "A_" : societyCategory;

    const activities = await repo.getActivitiesByCoachingType(resolved, prismaCategory, standard, termMonths);

    const result = activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        notes: activity.notes ?? null,
        fees: activity.fee_structures.map((f) => {
            const fee = {
                term_months: f.term_months,
                total_fee: parseFloat(f.total_fee),
            };
            if (f.effective_monthly !== null) {
                fee.effective_monthly = parseFloat(f.effective_monthly);
            }
            if (f.society_category !== null) {
                fee.society_category = SOCIETY_CATEGORY_DISPLAY[f.society_category] ?? f.society_category;
            }
            if (f.standard !== null) {
                fee.standard = f.standard;
            }
            return fee;
        }),
    }));

    return {
        coaching_type: coachingType,
        activities: result,
    };
};
