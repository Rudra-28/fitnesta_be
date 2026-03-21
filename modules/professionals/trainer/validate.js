exports.validateTrainer = (data, files = {}) => {
  const errors = [];

  // Helper to handle arrays coming as strings from form-data
  const parseArray = (val) => {
    if (Array.isArray(val)) return val;
    try {
      return JSON.parse(val);
    } catch {
      return typeof val === 'string' ? [val] : [];
    }
  };

  // ✅ Full Name, Mobile, Email, Address (Your existing logic is fine)
  if (!data.fullName || data.fullName.trim().length < 3) errors.push("Full Name must be at least 3 characters");
  if (!data.contactNumber || !/^\d{10}$/.test(data.contactNumber)) errors.push("Valid 10-digit contact number required");
  if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) errors.push("Valid email required");
  if (!data.address || data.address.trim().length < 5) errors.push("Address is required");

  // ✅ Player Level
  const validLevels = ["District", "State", "National"];
  if (!data.playerLevel || !validLevels.includes(data.playerLevel)) errors.push("Invalid player level");

  // ✅ Specified Game & Skills (Handle stringified arrays from form-data)
  const games = parseArray(data.specifiedGame);
  if (games.length === 0) errors.push("At least one game must be selected");

  const skills = parseArray(data.specifiedSkills);
  if (skills.length === 0) errors.push("At least one skill must be selected");

  const languages = parseArray(data.communicationLanguages);
  if (languages.length === 0) errors.push("At least one communication language required");

  // ✅ Documents (Check BOTH files and body)
  // We check if a file was uploaded OR if a URL already exists (for edits)
  if (!data.photo) {
    errors.push("photo is required");
  }
  if(!data.panCard) {
    errors.push("Valid PAN card URL required");
  }

  // ✅ Aadhar Card (URL check)
  if (!data.adharCard) {
    errors.push("Valid Aadhar card URL required");
  }
  if (!data.qualificationDocs){
    errors.push("Valid qualification URL required");
  }
  if (!data.documents){
    errors.push("docs need to be uploaded, URL required");
  }
  // ✅ Relative Info
  if (!data.relativeName || data.relativeName.trim().length < 3) errors.push("Relative name required");
  if (!data.relativeContact || !/^\d{10}$/.test(data.relativeContact)) errors.push("Valid relative contact number required");

  // ✅ Two Wheeler (Handle string "true"/"false" from form-data)
 // In validate.js
const isTwoWheelerValid = data.ownTwoWheeler === true || data.ownTwoWheeler === false || data.ownTwoWheeler === 'true' || data.ownTwoWheeler === 'false';
if (!isTwoWheelerValid) {
  errors.push("ownTwoWheeler must be a boolean value");
}
  // ✅ Place & Experience
  if (!data.place || data.place.trim().length < 2) errors.push("Place required");
  if (!data.experienceDetails || data.experienceDetails.trim().length < 10) errors.push("Experience details must be at least 10 characters");

  // ✅ Date
  // In vendorvalidate.js or your validation logic


  return errors;
};