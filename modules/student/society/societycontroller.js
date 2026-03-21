const service = require("./societyservice");
const { validateSociety } = require("./validatesociety");

exports.registerSociety = async (req, res) => {
  try {
    const data = req.body;

    // ✅ Validation
    const errors = validateSociety(data);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    const result = await service.registerSociety(data);

    return res.status(201).json(result);

  } catch (error) {
    console.error("Society Registration Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register society",
      error: error.message
    });
  }
};

exports.getSocieties = async (req, res) => {
  try {
    const societies = await service.getSocieties();

    res.json({
      success: true,
      data: societies
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch societies"
    });
  }
};