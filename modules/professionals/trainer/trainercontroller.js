const service = require("./trainerservice");

exports.createTrainer = async (req, res) => {
    try {
        // Merge uploaded file paths into body data
        const fileData = {};
        if (req.files) {
            if (req.files['photo'])             fileData.photo             = req.files['photo'][0].path;
            if (req.files['panCard'])           fileData.panCard           = req.files['panCard'][0].path;
            if (req.files['adharCard'])         fileData.adharCard         = req.files['adharCard'][0].path;
            if (req.files['qualificationDocs']) fileData.qualificationDocs = req.files['qualificationDocs'][0].path;
            if (req.files['documents'])         fileData.documents         = req.files['documents'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.createTrainer(data);

        res.status(201).json(result);

    } catch (err) {
        console.error("Trainer registration error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
