const service = require("./marketexeservice");
const log = require("../../../../utils/logger");

exports.createMarketExe = async (req, res) => {
    try {
        log.info("[marketing-exe] registration started", { name: req.body?.name, mobile: req.body?.mobile });
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])               fileData.panCard               = req.files['panCard'][0].path;
            if (req.files['adharCard'])             fileData.adharCard             = req.files['adharCard'][0].path;
            if (req.files['photo'])                 fileData.photo                 = req.files['photo'][0].path;
            if (req.files['activityAgreementsPdf']) fileData.activityAgreementsPdf = req.files['activityAgreementsPdf'][0].path;
        }

        const data = { ...req.body, ...fileData };
        log.info("[marketing-exe] form data assembled", { hasToken: !!data.idToken, filesUploaded: Object.keys(fileData) });
        const result = await service.createMarketExe(data);
        const userId = result.userId ?? result.id ?? null;
        log.info("[marketing-exe] registration complete — pending admin approval", { userId });

        res.status(201).json(result);

    } catch (err) {
        log.error("[marketing-exe] registration failed", err);
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.getAllMarketexe = async (req, res) => {
    try {
        const marketexe = await service.getAllMarketexe();
        res.json({ total: marketexe.length, data: marketexe });
    } catch (err) {
        log.error("[marketing-exe] getAllMarketexe failed", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
