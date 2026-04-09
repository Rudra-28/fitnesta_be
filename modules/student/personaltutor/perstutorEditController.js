const service = require("./perstutorEditService");

exports.editPT = async (req, res) => {
    try {
        const data = { ...req.body };
        const result = await service.editPT(req.user.userId, data);

        res.status(200).json(result);
    } catch (err) {
        console.error("Personal tutor edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
