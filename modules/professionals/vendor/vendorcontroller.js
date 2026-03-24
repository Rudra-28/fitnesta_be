const service = require("./vendorservice");
const {validateVendors } = require("./vendorvalidate");
exports.createVendors = async (req, res) => {
  try {
    console.time("TOTAL");
    console.time("FILES");
    const fileData = {};
    if (req.files) {
      if (req.files) {
        if (req.files['panCard'])           fileData.panCard = req.files['panCard'][0].path;
if (req.files['adharCard'])         fileData.adharCard = req.files['adharCard'][0].path;
if (req.files['GSTCertificate']) fileData.GSTCertificate = req.files['GSTCertificate'][0].path;
      }
    }
    console.timeEnd("FILES");
    const vendorData = { ...req.body, ...fileData };
    console.time("VALIDATION");
    const validationErrors = validateVendors(vendorData);
    console.timeEnd("VALIDATION");

    if (validationErrors.length > 0) {
      console.timeEnd("TOTAL");
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }
    console.time("SERVICE");
    const result = await service.createVendors(vendorData);
    console.timeEnd("SERVICE");
    console.timeEnd("TOTAL");
    res.json(result);
  } catch (err) {
    console.timeEnd("TOTAL");
    res.status(400).json({ error: err.message });
  }
};
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await service.getAllVendors();
    res.json({
      total: vendors.length,
      data: vendors
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};