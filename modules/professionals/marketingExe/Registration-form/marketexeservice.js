const repo = require("./marketexerepository");
const { validateMarketexe } = require("./marketexevalidate");

exports.createMarketExe = async (data) => {
    // 1. Normalize boolean
    data.ownTwoWheeler = (data.ownTwoWheeler === true || data.ownTwoWheeler === 'true') ? 1 : 0;

    // 2. Parse communicationLanguages array
    const parseIfString = (val) => {
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return val ? [val] : []; }
    };
    data.communicationLanguages = parseIfString(data.communicationLanguages);

    // 3. Normalize dates DD/MM/YYYY → YYYY-MM-DD (both date and dob)
    const convertDate = (d) => {
        if (d && typeof d === 'string' && d.includes('/')) {
            const [day, month, year] = d.split('/');
            return `${year}-${month}-${day}`;
        }
        return d;
    };
    data.date = convertDate(data.date);
    data.dob  = convertDate(data.dob);

    // 4. Validate
    const errors = validateMarketexe(data);
    if (errors.length > 0) throw new Error(errors.join(", "));

    // 5. Save to pending_registrations — does NOT touch users/professionals/marketing_executives yet
    const tempUuid = await repo.insertPending(data);

    // Notify user of form submission
    const fcmToken = data.fcmToken || data.fcm_token;
    if (fcmToken) {
        const { sendNotificationToToken } = require("../../../../utils/fcm");
        sendNotificationToToken(fcmToken, "Form Submitted", "Your form has been submitted to the admin for approval.");
    }

    return {
        success: true,
        tempUuid,
        message: "Registration submitted successfully. Awaiting admin approval."
    };
};

exports.getAllMarketexe = async () => {
    return await repo.getAllMarketexe();
};
