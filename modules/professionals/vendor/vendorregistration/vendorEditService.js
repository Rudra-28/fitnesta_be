const repo = require("./vendorEditRepository");

exports.editVendor = async (userId, data) => {
    const existing = await repo.getVendorByUserId(userId);
    if (!existing) throw new Error("Vendor not found");

    // ── users table fields ────────────────────────────────────────────────────
    const userData = {};
    if (data.contactNumber !== undefined) userData.mobile  = data.contactNumber;
    if (data.email         !== undefined) userData.email   = data.email;
    if (data.address       !== undefined) userData.address = data.address;

    // ── professionals table fields ────────────────────────────────────────────
    const professionalData = {};
    if (data.panCard   !== undefined) professionalData.pan_card   = data.panCard;
    if (data.adharCard !== undefined) professionalData.adhar_card = data.adharCard;

    // ── vendors table fields ──────────────────────────────────────────────────
    const vendorData = {};
    if (data.storeName      !== undefined) vendorData.store_name      = data.storeName;
    if (data.storeAddress   !== undefined) vendorData.store_address   = data.storeAddress;
    if (data.storeLocation  !== undefined) vendorData.store_location  = data.storeLocation;
    if (data.GSTCertificate !== undefined) vendorData.gst_certificate = data.GSTCertificate;

    await repo.updateVendor(userId, userData, professionalData, vendorData);

    return { success: true, message: "Profile updated successfully" };
};
