const repo = require("./trainerrepository");
const { validateTrainer } = require("./validate");

exports.createTrainer = async (data) => {
    // 1. Validate
    const errors = validateTrainer(data);
    if (errors.length > 0) throw new Error(errors.join(", "));

    // 2. Normalize date DD/MM/YYYY → YYYY-MM-DD
    if (data.date && data.date.includes("/")) {
        const [day, month, year] = data.date.split("/");
        data.date = `${year}-${month}-${day}`;
    }

    // 3. Normalize boolean
    data.ownTwoWheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true') ? 1 : 0;

    // 4. Parse JSON arrays that arrive as strings from multipart/form-data
    const parseIfString = (val) => {
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return val ? [val] : []; }
    };
    data.specifiedGame          = parseIfString(data.specifiedGame);
    data.specifiedSkills        = parseIfString(data.specifiedSkills);
    data.communicationLanguages = parseIfString(data.communicationLanguages);

    // 5. Save to pending_registrations — does NOT touch users/professionals/trainers yet
    const tempUuid = await repo.insertPending(data);

    // Notify user of form submission
    const fcmToken = data.fcmToken || data.fcm_token;
    if (fcmToken) {
        const { sendNotificationToToken } = require("../../../utils/fcm");
        sendNotificationToToken(fcmToken, "Form Submitted", "Your form has been submitted to the admin for approval.");
    }

    return {
        success: true,
        tempUuid,
        message: "Registration submitted successfully. Awaiting admin approval."
    };
};
