exports.validateOtherArea = (data) => {
  const errors = [];

  // 📱 Mobile (for user creation)
  if (!data.mobile) {
    errors.push("Mobile number is required");
  } else if (!/^[6-9]\d{9}$/.test(data.mobile)) {
    errors.push("Invalid mobile number");
  }

  // 🏷️ Sponsor Name
  if (!data.sponsorName) {
    errors.push("Sponsor name is required");
  }

  // 🤝 Coordinator Name
  if (!data.coordinatorName) {
    errors.push("Coordinator name is required");
  }

  // 📍 Address
  if (!data.address) {
    errors.push("Address is required");
  }

  // 📢 Marketing Incharge
  if (!data.marketingIncharge) {
    errors.push("Marketing incharge is required");
  }

  // 📄 PDF (URL or file path)
  if (!data.activityAgreementPdf) {
    errors.push("Activity agreement PDF is required");
  } else {
    const isValid =
      typeof data.activityAgreementPdf === "string" &&
      data.activityAgreementPdf.length > 5;
    if (!isValid) {
      errors.push("Invalid activity agreement PDF");
    }
  }
  return errors;
};