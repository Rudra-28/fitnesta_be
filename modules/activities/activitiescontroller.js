const service = require("./activitiesservice");

exports.getActivities = async (req, res) => {
    try {
        const { coaching_type, society_category } = req.query;
        const data = await service.getActivities(coaching_type, society_category ?? null);
        return res.status(200).json({ success: true, ...data });
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
