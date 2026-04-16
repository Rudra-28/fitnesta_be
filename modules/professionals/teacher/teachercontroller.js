const service = require("./teacherservice");

exports.createTeacher = async (req, res) => {
    try {
        console.log("[Teacher] createTeacher called");
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])   fileData.panCard   = req.files['panCard'][0].path;
            if (req.files['adharCard']) fileData.adharCard = req.files['adharCard'][0].path;
            if (req.files['dedDoc'])    fileData.dedDoc    = req.files['dedDoc'][0].path;
            if (req.files['bedDoc'])    fileData.bedDoc    = req.files['bedDoc'][0].path;
            if (req.files['otherDoc'])  fileData.otherDoc  = req.files['otherDoc'][0].path;
        }

        const data = { ...req.body, ...fileData };
        console.log("[Teacher] idToken:", data.idToken ? "present" : "missing", "| name:", data.name, "| files:", Object.keys(fileData));
        const result = await service.createTeacher(data);
        console.log("[Teacher] Registration complete — userId:", result.userId ?? result.id ?? "unknown");

        res.status(201).json(result);

    } catch (err) {
        console.error("[Teacher] Registration error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
