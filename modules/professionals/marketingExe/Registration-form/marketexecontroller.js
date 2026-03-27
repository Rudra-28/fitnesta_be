const service = require("./marketexeservice");

exports.createMarketExe = async (req, res) => {
    try {
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])               fileData.panCard               = req.files['panCard'][0].path;
            if (req.files['adharCard'])             fileData.adharCard             = req.files['adharCard'][0].path;
            if (req.files['photo'])                 fileData.photo                 = req.files['photo'][0].path;
            if (req.files['activityAgreementsPdf']) fileData.activityAgreementsPdf = req.files['activityAgreementsPdf'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.createMarketExe(data);

        res.status(201).json(result);

    } catch (err) {
        console.error("Marketing Executive registration error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.getAllMarketexe = async (req, res) => {
    try {
        const marketexe = await service.getAllMarketexe();
        res.json({ total: marketexe.length, data: marketexe });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
