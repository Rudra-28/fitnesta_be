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

  // Kit Type
  const validKits = ['Cricket', 'Football', 'Volleyball', 'Karate'];
  if (!data.kit_type || !validKits.includes(data.kit_type)) {
    errors.push("Kit type is required and must be Cricket, Football, Volleyball, or Karate");
  }

  return errors;
};
