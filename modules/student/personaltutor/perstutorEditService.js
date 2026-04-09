const repo = require("./perstutorEditRepository");

exports.editPT = async (userId, data) => {
    const existing = await repo.getPTByUserId(userId);
    if (!existing) throw new Error("Personal tutor student not found");

    // ── users table fields ────────────────────────────────────────────────────
    const userData = {};
    if (data.contactNumber !== undefined) userData.mobile    = data.contactNumber;
    if (data.fullName      !== undefined) userData.full_name = data.fullName;
    if (data.address       !== undefined) userData.address   = data.address;

    // ── personal_tutors table fields ──────────────────────────────────────────
    const ptData = {};
    if (data.standard      !== undefined) ptData.standard      = data.standard;
    if (data.batch         !== undefined) ptData.batch         = data.batch;
    if (data.teacherFor    !== undefined) ptData.teacher_for   = data.teacherFor;
    if (data.preferredTime !== undefined) ptData.preferred_time = data.preferredTime;

    await repo.updatePT(userId, userData, ptData);

    return { success: true, message: "Profile updated successfully" };
};
