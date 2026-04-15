const repo = require("./vendorrepository");
const { validateVendors } = require("./vendorvalidate");

exports.createVendors = async (data) => {
    // 1. Validate
    const errors = validateVendors(data);
    if (errors.length > 0) throw new Error(errors.join(", "));

    // 2. Save to pending_registrations — does NOT touch users/professionals/vendors yet
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

exports.getAllVendors = async () => {
    return await repo.getAllVendors();
};
