const service = require("./indicoachEditService");

exports.editIC = async (req, res) => {
    try {
        const data = { ...req.body };
        const result = await service.editIC(req.user.userId, data);

        res.status(200).json(result);
    } catch (err) {
        console.error("Individual coaching edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
