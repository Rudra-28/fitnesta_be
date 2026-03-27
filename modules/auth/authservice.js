const jwt = require("jsonwebtoken");
const repo = require("./authrepository");

exports.loginUser = async (mobile, role) => {
  // 1. Sanitize the mobile number (remove +91 if present)
  const cleanMobile = mobile.replace("+91", "");

  // 2. Find user in your MySQL/database by mobile only
  const user = await repo.findUserByMobile(cleanMobile);

  if (!user) {
    const pending = await repo.findPendingByMobile(cleanMobile);
    if (pending) {
      if (pending.status === 'pending')  throw new Error("APPROVAL_PENDING");
      if (pending.status === 'rejected') throw new Error("REGISTRATION_REJECTED");
    }
    throw new Error("USER_NOT_FOUND");
  }

  // 3. Block if not yet approved
  if (user.approval_status === 'pending') {
    throw new Error("APPROVAL_PENDING");
  }
  if (user.approval_status === 'rejected') {
    throw new Error("REGISTRATION_REJECTED");
  }

  // 4. Validate role
  if (user.role !== role) {
    throw new Error(`ROLE_MISMATCH`);
  }

  let subrole        = null;
  let referral_code  = null;
  let student_type   = null;

  // 5. Role Specific Verification
  if (role === "admin" || role === "sub_admin") {
    // no sub-table to check for admins
  } else if (role === "professional") {
    const profs = await repo.findProfessionalsByUserId(user.id);
    if (profs.length === 0) {
      throw new Error("PROFESSIONAL_DATA_MISMATCH");
    }

    // User requirement: Login if there is ONLY ONE row
    if (profs.length > 1) {
       throw new Error("MULTIPLE_SUBROLES_FOUND");
    }

    subrole       = profs[0].profession_type;
    referral_code = profs[0].referral_code ?? null;
  } else if (role === "student") {
    const students = await repo.findStudentsByUserId(user.id);
    // For students, login them in, just check their number is in table 
    // (which we already did via findUserByMobile and Role check)
    if (students.length > 0) {
        student_type = students[0].student_type;
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
      referral_code: role === "professional" ? referral_code : null,
      student_type: role === "student" ? student_type : null,
      isVerified: user.is_verified
    }
  };
};