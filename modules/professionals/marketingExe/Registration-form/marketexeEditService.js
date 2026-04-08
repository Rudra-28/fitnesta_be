const repo = require("./marketexeEditRepository");

exports.editME = async (userId, data) => {
    const existing = await repo.getMEByUserId(userId);
    if (!existing) throw new Error("Marketing executive not found");

    // ── users table fields ────────────────────────────────────────────────────
    const userData = {};
    if (data.contactNumber !== undefined) userData.mobile  = data.contactNumber;
    if (data.email         !== undefined) userData.email   = data.email;
    if (data.address       !== undefined) userData.address = data.address;
    if (data.photo         !== undefined) userData.photo   = data.photo;

    // ── professionals table fields ────────────────────────────────────────────
    const professionalData = {};
    if (data.ownTwoWheeler !== undefined) {
        professionalData.own_two_wheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true');
    }
    if (data.place !== undefined) professionalData.place = data.place;
    if (data.communicationLanguages !== undefined) {
        const parseIfString = (val) => {
            if (Array.isArray(val)) return val;
            try { return JSON.parse(val); } catch { return val ? [val] : []; }
        };
        professionalData.communication_languages = JSON.stringify(parseIfString(data.communicationLanguages));
    }

    // ── marketing_executives table fields ─────────────────────────────────────
    const meData = {};
    if (data.previousExperience !== undefined) meData.previous_experience = data.previousExperience;

    await repo.updateME(userId, userData, professionalData, meData);

    return { success: true, message: "Profile updated successfully" };
};
