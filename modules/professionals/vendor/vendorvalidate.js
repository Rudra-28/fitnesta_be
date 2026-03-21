exports.validateVendors = (data) => {
  const errors = [];

  // ===== BASIC USER DETAILS =====
  if (!data.fullName || data.fullName.trim().length < 3) {
    errors.push("Full Name must be at least 3 characters");
  }

  if (!data.contactNumber || !/^\d{10}$/.test(data.contactNumber)) {
    errors.push("Valid 10-digit contact number required");
  }

  if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
    errors.push("Valid email is required");
  }

  if (!data.address || data.address.trim().length < 5) {
    errors.push("Address is required");
  }

  // ===== PROFESSIONAL DOCUMENTS =====
  if (!data.panCard) {
    errors.push("Valid PAN card document required");
  }

  if (!data.adharCard) {
    errors.push("Valid Aadhar card document required");
  }

  // ===== VENDOR-SPECIFIC FIELDS =====
  if (!data.storeName || data.storeName.trim().length < 2) {
    errors.push("Store name is required");
  }

  if (!data.storeAddress || data.storeAddress.trim().length < 5) {
    errors.push("Store address is required");
  }

  if (!data.storeLocation) {
    errors.push("Store location is required");
  }

  if (!data.GSTCertificate) {
    errors.push("GST certificate document is required");
  }

  return errors;
};