const service = require("./vendorservice");
const log = require("../../../../utils/logger");

exports.createVendors = async (req, res) => {
    try {
        log.info("[vendor] registration started", { fullName: req.body?.fullName, mobile: req.body?.mobile });
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])         fileData.panCard         = req.files['panCard'][0].path;
            if (req.files['adharCard'])       fileData.adharCard       = req.files['adharCard'][0].path;
            if (req.files['GSTCertificate'])  fileData.GSTCertificate  = req.files['GSTCertificate'][0].path;
        }

        const data = { ...req.body, ...fileData };
        log.info("[vendor] form data assembled", { hasToken: !!data.idToken, filesUploaded: Object.keys(fileData) });
        const result = await service.createVendors(data);
        log.info("[vendor] registration complete — pending admin approval", { userId: result.userId ?? result.id ?? null });

        res.status(201).json(result);

    } catch (err) {
        log.error("[vendor] registration failed", err);
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.getAllVendors = async (req, res) => {
    try {
        const vendors = await service.getAllVendors();
        res.json({ total: vendors.length, data: vendors });
    } catch (err) {
        log.error("[vendor] getAllVendors failed", err);
        res.status(500).json({ success: false, error: err.message });
    }
};
