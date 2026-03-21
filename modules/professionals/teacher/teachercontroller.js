const service = require("./teacherservice");
exports.createTeacher = async (req, res) => {
  try {
    //console.log("FILES:", req.files);
    //console.log("BODY:", req.body);

    const fileData = {};


    if (req.files) {
    
      if (req.files['panCard'] && req.files['panCard'][0]) {
        fileData.panCard = req.files['panCard'][0].path;
      }
    
      if (req.files['adharCard'] && req.files['adharCard'][0]) {
        fileData.adharCard = req.files['adharCard'][0].path;
      }
    
      if (req.files['bedDoc'] && req.files['bedDoc'][0]) {
        fileData.bedDoc = req.files['bedDoc'][0].path;
      }
    
      if (req.files['dedDoc'] && req.files['dedDoc'][0]) {
        fileData.dedDoc = req.files['dedDoc'][0].path;
      }
    
      if (req.files['otherDoc'] && req.files['otherDoc'][0]) {
        fileData.otherDoc = req.files['otherDoc'][0].path;
      }
    }

    const teacherData = {
      ...req.body,
      ...fileData
    };

    // Fix undefined → null
    Object.keys(teacherData).forEach(key => {
      if (teacherData[key] === undefined) {
        teacherData[key] = null;
      }
    });

    console.log("=== TEACHER DEBUG ===");
    console.log("BODY KEYS:", Object.keys(req.body));
    console.log("BODY:", req.body);
    console.log("FILES:", req.files ? Object.keys(req.files) : "none");
    console.log("DATA SENT TO SERVICE:", teacherData);

    const result = await service.createTeacher(teacherData);

    res.status(201).json(result);

  } catch (err) {
    console.error("Detailed Error Log:", err);

    res.status(err.status || 400).json({
      error: err.message,
      errorCode: err.code || 'VALIDATION_OR_UNKNOWN_ERROR'
    });
  }
};