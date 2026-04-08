const service = require("./vendorEditService");

exports.editVendor = async (req, res) => {
    try {
        const fileData = {};
        if (req.files) {
            if (req.files['panCard'])        fileData.panCard        = req.files['panCard'][0].path;
            if (req.files['adharCard'])      fileData.adharCard      = req.files['adharCard'][0].path;
            if (req.files['GSTCertificate']) fileData.GSTCertificate = req.files['GSTCertificate'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.editVendor(req.user.userId, data);

        res.status(200).json(result);
    } catch (err) {
        console.error("Vendor edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
