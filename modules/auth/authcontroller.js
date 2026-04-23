const service = require("./authservice");
const repo = require("./authrepository");
const { getAdmin } = require("../../config/firebase");
const log = require("../../utils/logger");

// ── Pre-check: is this mobile number a registered admin? ─────────────────────
exports.checkAdmin = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: "mobile is required" });
    }

    const cleanMobile = mobile.replace("+91", "").trim();
    log.info("[auth] checkAdmin — mobile lookup", { mobile: cleanMobile });
    const user = await repo.findUserByMobile(cleanMobile);

    if (!user || user.role !== "admin") {
      log.warn("[auth] checkAdmin — admin not found", { mobile: cleanMobile });
      return res.status(404).json({ success: false, error_code: "USER_NOT_FOUND", message: "No admin account found with this number." });
    }
    if (user.approval_status === "pending") {
      log.warn("[auth] checkAdmin — approval pending", { userId: user.id, mobile: cleanMobile });
      return res.status(403).json({ success: false, error_code: "APPROVAL_PENDING" });
    }
    if (user.approval_status === "rejected") {
      log.warn("[auth] checkAdmin — registration rejected", { userId: user.id, mobile: cleanMobile });
      return res.status(403).json({ success: false, error_code: "REGISTRATION_REJECTED" });
    }
    if (user.is_suspended) {
      log.warn("[auth] checkAdmin — account suspended", { userId: user.id, mobile: cleanMobile });
      return res.status(403).json({ success: false, error_code: "ACCOUNT_SUSPENDED" });
    }

    log.info("[auth] checkAdmin — admin found, OTP flow can proceed", { userId: user.id });
    res.json({ success: true });
  } catch (err) {
    log.error("[auth] checkAdmin — unexpected error", err);
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

    log.info("[auth] login — verifying Firebase idToken", { role });

    // 1. Verify the Firebase ID token produced after OTP confirmation
    const firebaseAdmin = getAdmin();
    let decoded;
    try {
      decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    } catch (_) {
      log.warn("[auth] login — Firebase token verification failed", { role });
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP session. Please try again."
      });
    }

    // 2. Extract the verified phone number (+919876543210 → 9876543210)
    const phone = decoded.phone_number;
    if (!phone) {
      log.warn("[auth] login — no phone_number in Firebase token", { role });
      return res.status(400).json({ success: false, message: "No phone number in token." });
    }
    const mobile = phone.replace("+91", "").trim();

    log.info("[auth] login — Firebase token verified, looking up user", { mobile, role });

    // 3. Standard admin lookup + JWT issuance (existing logic)
    const result = await service.loginUser(mobile, role);

    log.info("[auth] login — success, JWT issued", { userId: result.user?.id, role, mobile });
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

    log.warn("[auth] login — failed", { error_code: error.message, role: req.body?.role, statusCode });
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

    let subrole        = null;
    let referral_code  = null;
    let student_type   = null;
    let school_name    = null;
    let school_address = null;

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

        // Pull school details for school_student type
        if (student_type === "school_student") {
          const schoolRecord = students[0].school_students?.[0];
          if (schoolRecord?.schools) {
            school_name    = schoolRecord.schools.school_name ?? null;
            school_address = schoolRecord.schools.address     ?? null;
          }
        }
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
          school_name: role === "student" ? (school_name ?? null) : null,
          school_address: role === "student" ? (school_address ?? null) : null,
          isVerified: user.is_verified ? 1 : 0
        }
      }
    });

  } catch (error) {
    log.error("[auth] getMe — unexpected error", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};