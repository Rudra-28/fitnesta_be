const service = require("./schoolservice");
const repo = require("./schoolrepo");
const { validateSchool } = require("./schoolvalidation");

exports.registerSchool = async (req, res) => {
  try {
    const data = req.body;
    
    // 1. Validate Form Fields
    const errors = validateSchool(data);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // 2. Prevent Duplicate School Names
    const existingSchool = await repo.getSchoolByName(data.schoolName);
    if (existingSchool) {
      return res.status(400).json({ success: false, message: "A school with this precise name is already registered." });
    }

    // 3. Register School
    const schoolId = await service.registerSchool(data);

    res.status(201).json({
      success: true,
      message: "School registered successfully",
      schoolId: schoolId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to register school",
      error: error.message
    });
  }
};

exports.getAllSchools = async (req, res) => {
  try {
    const schools = await service.getSchools();
    res.status(200).json({
      success: true,
      data: schools
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch schools",
      error: error.message
    });
  }
};
