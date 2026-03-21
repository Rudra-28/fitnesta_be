const service = require("./trainerservice");

exports.createTrainer = async (req, res) => {
  try {
    console.time("FILES");

    const fileData = {};

    if (req.files) {
      if (req.files) {
        if (req.files['panCard'])           fileData.panCard = req.files['panCard'][0].path;
if (req.files['adharCard'])         fileData.adharCard = req.files['adharCard'][0].path;
if (req.files['qualificationDocs']) fileData.qualificationDocs = req.files['qualificationDocs'][0].path;
if (req.files['photo'])             fileData.photo = req.files['photo'][0].path;
if (req.files['documents'])         fileData.documents         = req.files['documents'][0].path;
      }
    }

    console.log("FILES:", req.files);
    console.log("BODY:", req.body);
    console.timeEnd("FILES");

    // ✅ IMPORTANT FIX
    const trainerData = { ...req.body, ...fileData };

    const undefinedKeys = Object.entries(trainerData)
  .filter(([_, v]) => v === undefined)
  .map(([k]) => k);

if (undefinedKeys.length) console.warn("⚠️ Undefined fields:", undefinedKeys);

    console.log("DATA SENT TO SERVICE:", trainerData); // debug

    const result = await service.createTrainer(trainerData);

    res.status(201).json(result);

  } catch (err) {
    console.error("Detailed Error Log:", {
      message: err.message,
      stack: err.stack,
      sqlState: err.sqlState,
      code: err.code
    });

    res.status(err.status || 400).json({
      success: false,
      error: err.message,
      errorCode: err.code || 'VALIDATION_OR_UNKNOWN_ERROR'
    });
  }
};