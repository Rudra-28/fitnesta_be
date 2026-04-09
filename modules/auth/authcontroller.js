const service = require("./authservice");
const repo = require("./authrepository");

exports.login = async (req, res) => {
  try {
    const { mobile, role } = req.body;

    if (!mobile || !role) {
      return res.status(400).json({
        success: false,
        message: "mobile and role are required fields."
      });
    }

    console.log("REQ BODY:", req.body);

    const result = await service.loginUser(mobile, role);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });

  } catch (error) {
    // Map specific errors to appropriate Status Codes
    let statusCode = 500;
    let message = "Something went wrong during login. Please try again later.";

    if (error.message === "MISSING_PHONE_NUMBER") {
      statusCode = 400;
      message = "No phone number is associated with this Firebase account.";
    } else if (error.message === "USER_NOT_FOUND") {
      statusCode = 404;
      message = "No account found with this mobile number.";
    } else if (error.message === "ROLE_MISMATCH") {
      statusCode = 403;
      message = `You are not registered as a ${req.body.role || "this role"}.`;
    } else if (error.message === "PROFESSIONAL_DATA_MISMATCH" || error.message === "STUDENT_DATA_MISMATCH") {
      statusCode = 403;
      message = "Data mismatch: Registration incomplete.";
    } else if (error.message === "APPROVAL_PENDING") {
      statusCode = 403;
      message = "Your registration is pending admin approval. You will be notified once approved.";
    } else if (error.message === "REGISTRATION_REJECTED") {
      statusCode = 403;
      message = "Your registration was rejected. Please contact support.";
    }

    res.status(statusCode).json({
      success: false,
      message: message,
      error_code: error.message // Useful for frontend debugging
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const { userId, role } = req.user; // populated by verifyAccessToken
    
    // We can reuse the loginUser logic by fetching the user first, or just hit the DB
    // To match exact login response, let's fetch from DB directly.
    const user = await repo.findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let subrole = null;
    let referral_code = null;
    let student_type = null;

    if (role === "professional") {
      const profs = await repo.findProfessionalsByUserId(user.id);
      if (profs.length > 0) {
        subrole = profs[0].profession_type;
        referral_code = profs[0].referral_code ?? null;
      }
    } else if (role === "student") {
      const students = await repo.findStudentsByUserId(user.id);
      if (students.length > 0) {
        student_type = students[0].student_type;
      }
    }

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: {
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email,
          mobile: user.mobile,
          address: user.address ?? null,
          photo: user.photo ?? null,
          role: user.role,
          subrole: role === "professional" ? subrole : null,
          referral_code: role === "professional" ? referral_code : null,
          student_type: role === "student" ? student_type : null,
          isVerified: user.is_verified ? 1 : 0
        }
      }
    });

  } catch (error) {
    console.error("GET /me Error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};