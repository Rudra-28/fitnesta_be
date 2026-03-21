const jwt = require("jsonwebtoken");
const repo = require("./authrepository");

exports.loginUser = async (mobile, role, subrole, student_type) => {
  // 1. Sanitize the mobile number (remove +91 if present)
  const cleanMobile = mobile.replace("+91", "");

  // 2. Find user in your MySQL/database by mobile only
  const user = await repo.findUserByMobile(cleanMobile);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // 3. Validate role
  if (user.role !== role) {
    throw new Error(`ROLE_MISMATCH`);
  }

  // 4. Strict Subrole & Cross-reference Validation
  if (role === "professional") {
    if (!subrole) {
      throw new Error("SUBROLE_REQUIRED");
    }

    if (user.subrole !== subrole) {
      throw new Error("SUBROLE_MISMATCH");
    }

    const prof = await repo.findProfessionalByUserIdAndType(user.id, subrole);
    if (!prof) {
      throw new Error("PROFESSIONAL_DATA_MISMATCH");
    }
  } else if (role === "student") {
    if (!student_type) {
      throw new Error("STUDENT_TYPE_REQUIRED");
    }

    const studentData = await repo.findStudentByUserIdAndType(user.id, student_type);
    if (!studentData) {
      throw new Error("STUDENT_DATA_MISMATCH");
    }
  }

  // 3. Mark as verified if they are logging in for the first time
  if (!user.is_verified) {
    await repo.markUserVerified(user.id);
    user.is_verified = 1;
  }

  // 4. Sign your own JWT for app session management
  const token = jwt.sign(
    {
      userId: user.id,
      mobile: user.mobile,
      role: user.role,
      subrole: role === "professional" ? subrole : null,
      student_type: role === "student" ? student_type : null
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.full_name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      subrole: role === "professional" ? subrole : null,
      student_type: role === "student" ? student_type : null,
      isVerified: user.is_verified
    }
  };
};