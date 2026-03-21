// teacherValidator.js
module.exports = {
    validateTeacher: (data) => {
      const errors = [];
  
      // --- User Table Fields ---
      if (!data.fullName || typeof data.fullName !== "string" || data.fullName.trim().length < 3) {
        errors.push("Full name is required and must be at least 3 characters");
      }
  
      if (!data.contactNumber || !/^\d{10}$/.test(data.contactNumber)) {
        errors.push("Contact number is required and must be 10 digits");
      }
  
      if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) {
        errors.push("Valid email is required");
      }
  
      if (!data.address || data.address.trim().length < 5) {
        errors.push("Address is required and must be at least 5 characters");
      }
  
      // --- Professional Table Fields ---
      // Replace your existing PAN/Aadhar if blocks with this:
      if(!data.panCard) {
        errors.push("Valid PAN card URL required");
      }
    
      // ✅ Aadhar Card (URL check)
      if (!data.adharCard) {
        errors.push("Valid Aadhar card URL required");
      }
  
      if (!data.relativeName || data.relativeName.trim() === "") {
        errors.push("Relative name is required");
      }
  
      if (!data.relativeContact || !/^\d{10}$/.test(data.relativeContact)) {
        errors.push("Relative contact number is required and must be 10-15 digits");
      }
  
      if (typeof data.ownTwoWheeler !== "boolean") {
        errors.push("ownTwoWheeler must be boolean");
      }
  
      if (!Array.isArray(data.communicationLanguages) || data.communicationLanguages.length === 0) {
        errors.push("At least one communication language is required");
      }
  
      if (!data.place || data.place.trim() === "") {
        errors.push("Place is required");
      }
  
      if (!data.date || isNaN(Date.parse(data.date))) {
        errors.push("Valid ISO date is required");
      }
  
      // --- Teacher Specific Fields ---
      if (!data.subject || data.subject.trim() === "") {
        errors.push("Subject is required");
      }
  
      // experienceDetails can be empty, no validation needed
  
      // --- Documents (flattened) ---
      if (!data.dedDoc || typeof data.dedDoc !== "string") {
        errors.push("DED document is required");
      }
  
      if (!data.bedDoc || typeof data.bedDoc !== "string") {
        errors.push("BED document is required");
      }
  
      // otherDoc can be empty or null
      if (data.otherDoc && typeof data.otherDoc !== "string") {
        errors.push("Other document must be a string if provided");
      }
  
      return errors;
    }
  };