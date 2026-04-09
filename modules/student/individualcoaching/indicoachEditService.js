const repo = require("./indicoachEditRepository");

exports.editIC = async (userId, data) => {
    const existing = await repo.getICByUserId(userId);
    if (!existing) throw new Error("Individual coaching student not found");

    // ── users table fields ────────────────────────────────────────────────────
    const userData = {};
    if (data.contactNumber !== undefined) userData.mobile    = data.contactNumber;
    if (data.fullName      !== undefined) userData.full_name = data.fullName;

    // ── individual_participants table fields ──────────────────────────────────
    const participantData = {};
    if (data.fullName       !== undefined) participantData.participant_name = data.fullName;
    if (data.contactNumber  !== undefined) participantData.mobile           = data.contactNumber;
    if (data.flatNo         !== undefined) participantData.flat_no          = data.flatNo;
    if (data.societyName    !== undefined) participantData.society_name     = data.societyName;
    if (data.kitType        !== undefined) participantData.kits             = data.kitType;
    if (data.preferredBatch !== undefined) participantData.preferred_batch  = data.preferredBatch;
    if (data.preferredTime  !== undefined) participantData.preferred_time   = data.preferredTime;

    await repo.updateIC(userId, userData, participantData);

    return { success: true, message: "Profile updated successfully" };
};
