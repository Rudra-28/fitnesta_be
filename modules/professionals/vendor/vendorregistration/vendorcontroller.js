const service = require("./vendorservice");

exports.createVendors = async (req, res) => {
    try {
        console.log("[Vendor] createVendors called");
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])         fileData.panCard         = req.files['panCard'][0].path;
            if (req.files['adharCard'])       fileData.adharCard       = req.files['adharCard'][0].path;
            if (req.files['GSTCertificate'])  fileData.GSTCertificate  = req.files['GSTCertificate'][0].path;
        }

        const data = { ...req.body, ...fileData };
        console.log("[Vendor] idToken:", data.idToken ? "present" : "missing", "| fullName:", data.fullName, "| files:", Object.keys(fileData));
        const result = await service.createVendors(data);
        console.log("[Vendor] Registration complete — userId:", result.userId ?? result.id ?? "unknown");

        res.status(201).json(result);

    } catch (err) {
        console.error("[Vendor] Registration error:", err.message);
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
