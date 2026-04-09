const service = require("./teacherEditService");

exports.editTeacher = async (req, res) => {
    try {
        console.log(`[Teacher Edit Profile] Request received for User ID: ${req.user.userId}`);
        console.log(`[Teacher Edit Profile] Request Body:`, req.body);

        const data = { ...req.body };
        const result = await service.editTeacher(req.user.userId, data);

        console.log(`[Teacher Edit Profile] Successfully updated. Returning Response:`, result);
        res.status(200).json(result);
    } catch (err) {
        console.error("Teacher edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
