const service = require("./schoolstudentEditService");

exports.editSchoolStudent = async (req, res) => {
    try {
        const data = { ...req.body };
        const result = await service.editSchoolStudent(req.user.userId, data);

        res.status(200).json(result);
    } catch (err) {
        console.error("School student edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
