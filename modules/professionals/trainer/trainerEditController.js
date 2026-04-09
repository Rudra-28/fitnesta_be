const service = require("./trainerEditService");

exports.editTrainer = async (req, res) => {
    try {
        console.log(`[Trainer Edit Profile] Request received for User ID: ${req.user.userId}`);
        console.log(`[Trainer Edit Profile] Request Body:`, req.body);
        console.log(`[Trainer Edit Profile] Uploaded Files:`, req.files ? Object.keys(req.files) : 'None');

        const fileData = {};
        if (req.files) {
            if (req.files['photo']) fileData.photo = req.files['photo'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.editTrainer(req.user.userId, data);

        console.log(`[Trainer Edit Profile] Successfully updated. Returning Response:`, result);
        res.status(200).json(result);
    } catch (err) {
        console.error("Trainer edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
