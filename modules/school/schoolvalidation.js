exports.validateSchool = (data) => {
  if (!data || Object.keys(data).length === 0) {
    return ["Form data is missing. Please provide the registration payload."];
  }

  const errors = [];

  // School Name
  if (!data.schoolName || data.schoolName.trim().length < 3) {
    errors.push("School name is required and must be at least 3 characters");
  }

  // Address
  if (!data.address || data.address.trim().length < 5) {
    errors.push("Address is required");
  }

  // Pin Code
  if (!data.pinCode || data.pinCode.trim().length < 6) {
    errors.push("Valid pin code is required");
  }

  // State
  if (!data.state) {
    errors.push("State is required");
  }

  // Principal Name & Contact
  if (!data.principalName) {
    errors.push("Principal name is required");
  }
 if (!data.principalContact || !/^\d{10}$/.test(data.principalContact)) {
  errors.push("Invalid principal contact number");
}

  return errors;
};
