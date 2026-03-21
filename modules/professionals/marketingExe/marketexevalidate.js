exports.validateMarketexe = (data) => {
    let errors = [];
  
    // USER
    if (!data.fullName || data.fullName.trim().length < 3) {
      errors.push("Full Name is required (min 3 characters).");
    }
  
    const mobile = data.contactNumber || data.mobile;
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      errors.push("Valid Indian mobile number required (starts with 6-9).");
    }
  
    if (!data.address || data.address.trim().length < 5) {
      errors.push("Residential address is required.");
    }
  
    // PROFESSIONAL DOCUMENTS (file paths, not URLs)
    if (!data.panCard) {
      errors.push("PAN card document is required.");
    }
  
    if (!data.adharCard) {
      errors.push("Aadhaar card document is required.");
    }
  
    if (!data.place || data.place.trim() === "") {
      errors.push("Place/City is required.");
    }
  
    if (!Array.isArray(data.communicationLanguages) || data.communicationLanguages.length === 0) {
      errors.push("At least one communication language is required.");
    }
  
    // MARKETING EXEC
    if (!data.dob) {
      errors.push("Date of Birth is required.");
    }
  
    if (!data.educationQualification || data.educationQualification.trim() === "") {
      errors.push("Educational qualification is required.");
    }
  
    if (!data.previousExperience || data.previousExperience.trim() === "") {
      errors.push("Previous experience is required.");
    }

    if (!data.activityAgreementsPdf) {
      errors.push("Activity agreements PDF document is required.");
    }
  
    return errors;
  };
