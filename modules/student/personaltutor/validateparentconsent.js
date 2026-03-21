exports.validateParentConsent = (data) => {
  if (!data) return ["FormData is completely missing"];

  const errors = [];

  // 🏢 Society Name
  if (!data.society_name) {
    errors.push("Society name is required");
  }

  // 👨 Parent Name
  if (!data.parentName || data.parentName.trim().length < 3) {
    errors.push("Parent name is required");
  }

  // 📞 Emergency Contact
  if (!data.emergencyContactNo) {
    errors.push("Emergency contact number is required");
  } else if (!/^[6-9]\d{9}$/.test(data.emergencyContactNo)) {
    errors.push("Invalid emergency contact number");
  }

  // 🎯 Activity Enrolled
  if (!data.activity_enrolled) {
    errors.push("Activity enrolled is required");
  }

  // ✍️ Signature URL
  if (!data.signatureUrl) {
    errors.push("Parent signature is required");
  }

  // 📅 Consent Date
  if (!data.consent_date) {
    errors.push("Consent date is required");
  } else if (isNaN(Date.parse(data.consent_date))) {
    errors.push("Invalid consent date");
  }

  return errors;
};