const service = require("./trainerEditService");

exports.editTrainer = async (req, res) => {
    try {
        const fileData = {};
        if (req.files) {
            if (req.files['photo']) fileData.photo = req.files['photo'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.editTrainer(req.user.userId, data);

        res.status(200).json(result);
    } catch (err) {
        console.error("Trainer edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
