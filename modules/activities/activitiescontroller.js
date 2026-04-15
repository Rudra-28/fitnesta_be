const service = require("./activitiesservice");

exports.getActivities = async (req, res) => {
    try {
        const { coaching_type, society_category, standard, term_months, custom_category_name } = req.query;
        const termMonths = term_months ? parseInt(term_months, 10) : null;
        const data = await service.getActivities(coaching_type, society_category ?? null, standard ?? null, termMonths, custom_category_name ?? null);
        return res.status(200).json({ success: true, ...data });
    } catch (err) {
        return res.status(err.status ?? 500).json({ success: false, message: err.message });
    }
};

exports.getPersonalTutorStandards = async (_req, res) => {
    try {
        const standards = await service.getPersonalTutorStandards();
        return res.status(200).json({ success: true, standards });
    } catch (err) {
        return res.status(err.status ?? 500).json({ success: false, message: err.message });
    }
};

exports.getSubjects = async (_req, res) => {
    try {
        const data = await service.getActivities("personal_tutor");
        return res.status(200).json({ success: true, ...data });
    } catch (err) {
        return res.status(err.status ?? 500).json({ success: false, message: err.message });
    }
};
