const service = require("./teacherEditService");

exports.editTeacher = async (req, res) => {
    try {
        const data = { ...req.body };
        const result = await service.editTeacher(req.user.userId, data);

        res.status(200).json(result);
    } catch (err) {
        console.error("Teacher edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
