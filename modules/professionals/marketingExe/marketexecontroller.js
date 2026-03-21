const service = require("./marketexeservice");

exports.createMarketExe = async (req, res) => {
  try {
    const fileData = {};

    if (req.files) {
      if (req.files['panCard']               && req.files['panCard'][0])               fileData.panCard               = req.files['panCard'][0].path;
      if (req.files['adharCard']             && req.files['adharCard'][0])             fileData.adharCard             = req.files['adharCard'][0].path;
      if (req.files['photo']                 && req.files['photo'][0])                 fileData.photo                 = req.files['photo'][0].path;
      if (req.files['activityAgreementsPdf'] && req.files['activityAgreementsPdf'][0]) fileData.activityAgreementsPdf = req.files['activityAgreementsPdf'][0].path;
    }

    const marketData = { ...req.body, ...fileData };

    console.log("=== MARKET EXE DEBUG ===");
    console.log("BODY KEYS:", Object.keys(req.body));
    console.log("FILES:", req.files ? Object.keys(req.files) : "none");
    console.log("DATA SENT TO SERVICE:", marketData);

    const result = await service.createMarketExe(marketData);

    res.status(201).json({
      success: true,
      message: "Marketing Executive created successfully",
      data: result
    });

  } catch (err) {
    console.error("Market Exe Error:", {
      message: err.message,
      stack: err.stack,
      code: err.code
    });
    res.status(err.status || 400).json({
      success: false,
      error: err.message,
      errorCode: err.code || 'VALIDATION_OR_UNKNOWN_ERROR'
    });
  }
};

exports.getAllMarketexe = async (req, res) => {
  try {
    const marketexe = await service.getAllMarketexe();
    res.json({
      total: marketexe.length,
      data: marketexe
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};