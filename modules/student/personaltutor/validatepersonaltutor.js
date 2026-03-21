exports.validatePersonalTutor = (data) => {
  const errors = [];

  if (!data || Object.keys(data).length === 0) {
    return ["Form data is missing. Please provide the registration payload."];
  }

  // 📱 Mobile
  if (!data.contactNumber) {
    errors.push("Mobile number is required");
  } else if (!/^[6-9]\d{9}$/.test(data.contactNumber)) {
    errors.push("Invalid mobile number");
  }

  // 👤 Full Name
  if (!data.fullName || data.fullName.trim().length < 3) {
    errors.push("Full name is required and must be at least 3 characters");
  }

  // 📍 Address
  if (!data.address || data.address.trim().length < 5) {
    errors.push("Address is required");
  }

  // 🎂 DOB
  if (!data.dob) {
    errors.push("Date of birth is required");
  } else if (isNaN(Date.parse(data.dob))) {
    errors.push("Invalid date of birth");
  }

  // 🎓 Standard
  if (!data.standard) {
    errors.push("Standard is required");
  }

  // 🕒 Batch
  if (!data.batch) {
    errors.push("Batch is required");
  }

  // 📚 Teacher For
  if (!data.teacherFor) {
    errors.push("Teacher for field is required");
  }

  return errors;
};