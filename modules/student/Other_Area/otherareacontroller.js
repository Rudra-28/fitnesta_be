const service = require("./otherareaservice");
const { validateOtherArea } = require("./otherareavalidate");

exports.registerOtherarea = async (req, res) => {
  try {
    if (req.files && req.files.activityAgreementPdf && req.files.activityAgreementPdf.length > 0) {
        req.body.activityAgreementPdf = req.files.activityAgreementPdf[0].path;
    }

    const data = req.body;
    const errors = validateOtherArea(data);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    const result = await service.registerOtherarea(data);

    return res.status(201).json(result);

  } catch (error) {
    console.error("area Registration Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register area",
      error: error.message
    });
  }
};