const repo = require("./teacherepository");
const { validateTeacher } = require("./validate");

exports.createTeacher = async (data) => {
    // 1. Normalize boolean — keep as true/false so validator passes,
    //    repository handles converting to 1/0 for MySQL
    data.ownTwoWheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true') ? true : false;

    // 2. Normalize date DD/MM/YYYY → YYYY-MM-DD
    if (data.date && data.date.includes("/")) {
        const [day, month, year] = data.date.split("/");
        data.date = `${year}-${month}-${day}`;
    }

    // 3. Parse communicationLanguages array
    const parseIfString = (val) => {
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return val ? [val] : []; }
    };
    data.communicationLanguages = parseIfString(data.communicationLanguages);

    // 4. Validate
    const errors = validateTeacher(data);
    if (errors.length > 0) throw new Error(errors.join(", "));

    // 5. Save to pending_registrations — does NOT touch users/professionals/teachers yet
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
