exports.validateSchoolStudent = (data) => {
  if (!data || Object.keys(data).length === 0) {
    return ["Form data is missing. Please provide the registration payload."];
  }

  const errors = [];

  // Mobile
  if (!data.mobile) {
    errors.push("Mobile number is required");
  } else if (!/^[6-9]\d{9}$/.test(data.mobile)) {
    errors.push("Invalid mobile number format");
  }

  // Full Name
  if (!data.fullName || data.fullName.trim().length < 3) {
    errors.push("Full name is required and must be at least 3 characters");
  }

  // School Name
  if (!data.schoolName) {
    errors.push("Please select a school to register under.");
  }

  // Standard
  if (!data.standard) {
    errors.push("Standard/Grade is required");
  }

  // activity_ids — required array of activity IDs
  if (!data.activity_ids || !Array.isArray(data.activity_ids) || data.activity_ids.length === 0)
    errors.push("At least one activity must be selected");
  else if (data.activity_ids.some(id => isNaN(Number(id))))
    errors.push("All activity_ids must be valid numbers");

  // product_ids — optional array of vendor product IDs for kit purchase
  if (data.product_ids !== undefined && data.product_ids !== null) {
    if (!Array.isArray(data.product_ids))
      errors.push("product_ids must be an array of product IDs");
    else if (data.product_ids.some(id => isNaN(Number(id))))
      errors.push("All product_ids must be valid numbers");
  }

  return errors;
};
