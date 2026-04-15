const service = require("./authservice");
const repo = require("./authrepository");
const { getAdmin } = require("../../config/firebase");

// ── Pre-check: is this mobile number a registered admin? ─────────────────────
exports.checkAdmin = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: "mobile is required" });
    }

    const cleanMobile = mobile.replace("+91", "").trim();
    const user = await repo.findUserByMobile(cleanMobile);

    if (!user || user.role !== "admin") {
      return res.status(404).json({ success: false, error_code: "USER_NOT_FOUND", message: "No admin account found with this number." });
    }
    if (user.approval_status === "pending") {
      return res.status(403).json({ success: false, error_code: "APPROVAL_PENDING" });
    }
    if (user.approval_status === "rejected") {
      return res.status(403).json({ success: false, error_code: "REGISTRATION_REJECTED" });
    }
    if (user.is_suspended) {
      return res.status(403).json({ success: false, error_code: "ACCOUNT_SUSPENDED" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("checkAdmin error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Login: verify Firebase phone idToken → issue our own JWT ──────────────────
exports.login = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken || !role) {
      return res.status(400).json({
        success: false,
        message: "idToken and role are required fields."
      });
    }

    // 1. Verify the Firebase ID token produced after OTP confirmation
    const firebaseAdmin = getAdmin();
    let decoded;
    try {
      decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    } catch (_) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP session. Please try again."
      });
    }

    // 2. Extract the verified phone number (+919876543210 → 9876543210)
    const phone = decoded.phone_number;
    if (!phone) {
      return res.status(400).json({ success: false, message: "No phone number in token." });
    }
    const mobile = phone.replace("+91", "").trim();

    // 3. Standard admin lookup + JWT issuance (existing logic)
    const result = await service.loginUser(mobile, role);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });

  } catch (error) {
    let statusCode = 500;
    let message = "Something went wrong during login. Please try again later.";

    if (error.message === "USER_NOT_FOUND") {
      statusCode = 404; message = "No account found with this mobile number.";
    } else if (error.message === "ROLE_MISMATCH") {
      statusCode = 403; message = `You are not registered as a ${req.body.role || "this role"}.`;
    } else if (error.message === "PROFESSIONAL_DATA_MISMATCH" || error.message === "STUDENT_DATA_MISMATCH") {
      statusCode = 403; message = "Data mismatch: Registration incomplete.";
    } else if (error.message === "APPROVAL_PENDING") {
      statusCode = 403; message = "Your registration is pending admin approval.";
    } else if (error.message === "REGISTRATION_REJECTED") {
      statusCode = 403; message = "Your registration was rejected. Please contact support.";
    } else if (error.message === "ACCOUNT_SUSPENDED") {
      statusCode = 403; message = "Your account has been suspended. Please contact support.";
    } else if (error.message === "ADMIN_RECORD_NOT_FOUND") {
      statusCode = 403; message = "Admin record not found. Please contact super-admin.";
    }

    res.status(statusCode).json({
      success: false,
      message,
      error_code: error.message
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