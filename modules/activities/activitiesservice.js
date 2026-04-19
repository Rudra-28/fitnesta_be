const repo = require("./activitiesrepository");

const VALID_COACHING_TYPES = ["individual_coaching", "group_coaching", "personal_tutor", "school_student"];
const VALID_SOCIETY_CATEGORIES = ["A+", "A", "B", "custom"];

// "trainer" is a virtual alias — returns activities for both individual_coaching and school_student
const ALIAS_MAP = { trainer: "trainer" };

// Prisma maps the "A+" enum value to "A_" internally — convert back for API responses
const SOCIETY_CATEGORY_DISPLAY = {
    A_: "A+",
    A:  "A",
    B:  "B",
};

exports.getPersonalTutorStandards = async () => {
    return await repo.getPersonalTutorStandards();
};

exports.getActivities = async (coachingType, societyCategory = null, standard = null, termMonths = null, customCategoryName = null) => {
    // No coaching_type → return plain activity list
    if (!coachingType) {
        const activities = await repo.getAllActiveActivities();
        return { activities };
    }

    // "trainer" → fetch activities for individual_coaching, school_student, and group_coaching, deduplicated
    if (coachingType === "trainer") {
        const [ic, ss, gc] = await Promise.all([
            repo.getActivitiesByCoachingType("individual_coaching", null, null, null),
            repo.getActivitiesByCoachingType("school_student", null, null, null),
            repo.getActivitiesByCoachingType("group_coaching", null, null, null),
        ]);
        const seen = new Set();
        const activities = [];
        for (const a of [...ic, ...ss, ...gc]) {
            if (!seen.has(a.id)) {
                seen.add(a.id);
                activities.push({ id: a.id, name: a.name, notes: a.notes ?? null, image_url: a.image_url ?? null });
            }
        }
        return { coaching_type: "trainer", activities };
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
            const err = new Error(`Invalid society_category. Allowed values: A+, A, B, custom`);
            err.status = 400;
            throw err;
        }
    }

    if (resolved === "personal_tutor") {
        const validStandards = await repo.getPersonalTutorStandards();
        if (!standard) {
            const err = new Error(`standard is required for personal_tutor. Allowed values: ${validStandards.join(", ")}`);
            err.status = 400;
            throw err;
        }
        if (!validStandards.includes(standard)) {
            const err = new Error(`Invalid standard. Allowed values: ${validStandards.join(", ")}`);
            err.status = 400;
            throw err;
        }
    }

    // Convert "A+" → "A_" for Prisma enum lookup
    const prismaCategory = societyCategory === "A+" ? "A_" : societyCategory;

    // For custom category, pass customCategoryName so only activities with fees for that custom tier are returned
    const resolvedCustomName = societyCategory === "custom" ? (customCategoryName ?? null) : null;

    const activities = await repo.getActivitiesByCoachingType(resolved, prismaCategory, standard, termMonths, resolvedCustomName);

    const result = activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        notes: activity.notes ?? null,
        image_url: activity.image_url ?? null,
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
            if (f.custom_category_name !== null) {
                fee.custom_category_name = f.custom_category_name;
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
