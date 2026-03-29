const service = require("./vendorservice");

exports.createVendors = async (req, res) => {
    try {
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])         fileData.panCard         = req.files['panCard'][0].path;
            if (req.files['adharCard'])       fileData.adharCard       = req.files['adharCard'][0].path;
            if (req.files['GSTCertificate'])  fileData.GSTCertificate  = req.files['GSTCertificate'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.createVendors(data);

        res.status(201).json(result);

    } catch (err) {
        console.error("Vendor registration error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};

exports.getAllVendors = async (req, res) => {
    try {
        const vendors = await service.getAllVendors();
        res.json({ total: vendors.length, data: vendors });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
