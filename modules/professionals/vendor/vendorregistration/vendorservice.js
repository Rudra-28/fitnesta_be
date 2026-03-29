const repo = require("./vendorrepository");
const { validateVendors } = require("./vendorvalidate");

exports.createVendors = async (data) => {
    // 1. Validate
    const errors = validateVendors(data);
    if (errors.length > 0) throw new Error(errors.join(", "));

    // 2. Save to pending_registrations — does NOT touch users/professionals/vendors yet
    const tempUuid = await repo.insertPending(data);

    return {
        success: true,
        tempUuid,
        message: "Registration submitted successfully. Awaiting admin approval."
    };
};

exports.getAllVendors = async () => {
    return await repo.getAllVendors();
};
