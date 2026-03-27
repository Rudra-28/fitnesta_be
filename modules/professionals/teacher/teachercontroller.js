const service = require("./teacherservice");

exports.createTeacher = async (req, res) => {
    try {
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])   fileData.panCard   = req.files['panCard'][0].path;
            if (req.files['adharCard']) fileData.adharCard = req.files['adharCard'][0].path;
            if (req.files['dedDoc'])    fileData.dedDoc    = req.files['dedDoc'][0].path;
            if (req.files['bedDoc'])    fileData.bedDoc    = req.files['bedDoc'][0].path;
            if (req.files['otherDoc'])  fileData.otherDoc  = req.files['otherDoc'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.createTeacher(data);

        res.status(201).json(result);

    } catch (err) {
        console.error("Teacher registration error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
