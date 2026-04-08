const repo = require("./trainerEditRepository");

exports.editTrainer = async (userId, data) => {
    const existing = await repo.getTrainerByUserId(userId);
    if (!existing) throw new Error("Trainer not found");

    const parseIfString = (val) => {
        if (val === undefined) return undefined;
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return val ? [val] : []; }
    };

    // ── users table fields ────────────────────────────────────────────────────
    const userData = {};
    if (data.contactNumber !== undefined) userData.mobile       = data.contactNumber;
    if (data.email         !== undefined) userData.email        = data.email;
    if (data.address       !== undefined) userData.address      = data.address;
    if (data.photo         !== undefined) userData.photo        = data.photo;

    // ── professionals table fields ────────────────────────────────────────────
    const professionalData = {};
    if (data.ownTwoWheeler !== undefined) {
        professionalData.own_two_wheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true');
    }
    if (data.communicationLanguages !== undefined) {
        const langs = parseIfString(data.communicationLanguages);
        professionalData.communication_languages = JSON.stringify(langs);
    }
    if (data.place !== undefined) professionalData.place = data.place;

    // ── trainers table fields ─────────────────────────────────────────────────
    const trainerData = {};
    if (data.playerLevel       !== undefined) trainerData.player_level       = data.playerLevel;
    if (data.experienceDetails !== undefined) trainerData.experience_details = data.experienceDetails;
    if (data.specifiedGame !== undefined) {
        trainerData.specified_game = parseIfString(data.specifiedGame);
    }
    if (data.specifiedSkills !== undefined) {
        trainerData.specified_skills = parseIfString(data.specifiedSkills);
    }

    await repo.updateTrainer(userId, userData, professionalData, trainerData);

    return { success: true, message: "Profile updated successfully" };
};
