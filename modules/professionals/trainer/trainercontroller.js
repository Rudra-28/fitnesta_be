const service = require("./trainerservice");
const log = require("../../../utils/logger");

exports.createTrainer = async (req, res) => {
    try {
        log.info("[trainer] registration started", { name: req.body?.name, mobile: req.body?.mobile });
        const fileData = {};
        if (req.files) {
            if (req.files['photo'])             fileData.photo             = req.files['photo'][0].path;
            if (req.files['panCard'])           fileData.panCard           = req.files['panCard'][0].path;
            if (req.files['adharCard'])         fileData.adharCard         = req.files['adharCard'][0].path;
            if (req.files['qualificationDocs']) fileData.qualificationDocs = req.files['qualificationDocs'][0].path;
            if (req.files['documents'])         fileData.documents         = req.files['documents'][0].path;
        }

        const data = { ...req.body, ...fileData };
        log.info("[trainer] form data assembled", { hasToken: !!data.idToken, filesUploaded: Object.keys(fileData) });
        const result = await service.createTrainer(data);
        const userId = result.userId ?? result.id ?? null;
        log.info("[trainer] registration complete — pending admin approval", { userId });

        res.status(201).json(result);

    } catch (err) {
        log.error("[trainer] registration failed", err);
        res.status(400).json({ success: false, error: err.message });
    }
};
