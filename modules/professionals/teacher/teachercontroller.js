const service = require("./teacherservice");
const log = require("../../../utils/logger");

exports.createTeacher = async (req, res) => {
    try {
        log.info("[teacher] registration started", { name: req.body?.name, mobile: req.body?.mobile });
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])   fileData.panCard   = req.files['panCard'][0].path;
            if (req.files['adharCard']) fileData.adharCard = req.files['adharCard'][0].path;
            if (req.files['dedDoc'])    fileData.dedDoc    = req.files['dedDoc'][0].path;
            if (req.files['bedDoc'])    fileData.bedDoc    = req.files['bedDoc'][0].path;
            if (req.files['otherDoc'])  fileData.otherDoc  = req.files['otherDoc'][0].path;
        }

        const data = { ...req.body, ...fileData };
        log.info("[teacher] form data assembled", { hasToken: !!data.idToken, filesUploaded: Object.keys(fileData) });
        const result = await service.createTeacher(data);
        const userId = result.userId ?? result.id ?? null;
        log.info("[teacher] registration complete — pending admin approval", { userId });

        res.status(201).json(result);

    } catch (err) {
        log.error("[teacher] registration failed", err);
        res.status(400).json({ success: false, error: err.message });
    }
};
