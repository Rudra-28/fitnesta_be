const repo = require("./schoolstudentEditRepository");

exports.editSchoolStudent = async (userId, data) => {
    const existing = await repo.getSchoolStudentByUserId(userId);
    if (!existing) throw new Error("School student not found");

    // ── users table fields ────────────────────────────────────────────────────
    const userData = {};
    if (data.mobile    !== undefined) userData.mobile     = data.mobile;
    if (data.fullName  !== undefined) userData.full_name  = data.fullName;
    if (data.address   !== undefined) userData.address    = data.address;

    // ── school_students table fields ──────────────────────────────────────────
    const schoolStudentData = {};
    if (data.fullName  !== undefined) schoolStudentData.student_name = data.fullName;
    if (data.standard  !== undefined) schoolStudentData.standard     = data.standard;
    if (data.address   !== undefined) schoolStudentData.address      = data.address;

    await repo.updateSchoolStudent(userId, userData, schoolStudentData);

    return { success: true, message: "Profile updated successfully" };
};
