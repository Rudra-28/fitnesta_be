const service = require("./authservice");

exports.login = async (req, res) => {
  try {
    const { mobile, role, subrole, student_type } = req.body;

    if (!mobile || !role) {
      return res.status(400).json({
        success: false,
        message: "mobile and role are required fields."
      });
    }

    console.log("REQ BODY:", req.body);

    const result = await service.loginUser(mobile, role, subrole, student_type);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });

  } catch (error) {
    // Map specific errors to appropriate Status Codes
    let statusCode = 500;
    let message = "Something went wrong during login. Please try again later.";

    if (error.message === "INVALID_FIREBASE_TOKEN") {
      statusCode = 401;
      message = "The provided session has expired or is invalid. Please log in again.";
    } else if (error.message === "MISSING_PHONE_NUMBER") {
      statusCode = 400;
      message = "No phone number is associated with this Firebase account.";
    } else if (error.message === "USER_NOT_FOUND") {
      statusCode = 404;
      message = "No account found with this mobile number.";
    } else if (error.message === "ROLE_MISMATCH") {
      statusCode = 403;
      message = `You are not registered as a ${req.body.role || "this role"}.`;
    } else if (error.message === "SUBROLE_REQUIRED" || error.message === "STUDENT_TYPE_REQUIRED") {
      statusCode = 400;
      message = "Subrole/Student type is required for login.";
    } else if (error.message === "SUBROLE_MISMATCH") {
      statusCode = 403;
      message = `You are not registered as a ${req.body.subrole || "this role"}.`;
    } else if (error.message === "PROFESSIONAL_DATA_MISMATCH" || error.message === "STUDENT_DATA_MISMATCH") {
      statusCode = 403;
      message = "Data mismatch: Registration incomplete.";
    }

    res.status(statusCode).json({
      success: false,
      message: message,
      error_code: error.message // Useful for frontend debugging
    });
  }
};