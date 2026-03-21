exports.validateSociety = (data) => {
  const errors = [];

  // 📱 Mobile
  if (!data.mobile) {
    errors.push("Mobile number is required");
  } else if (!/^[6-9]\d{9}$/.test(data.mobile)) {
    errors.push("Invalid mobile number");
  }

  // 🏢 Society Name
  if (!data.societyName) {
    errors.push("Society name is required");
  }

  // 🏷️ Category
  if (!data.societyCategory) {
    errors.push("Society category is required");
  }

  // 📍 Address
  if (!data.address) {
    errors.push("Address is required");
  }

  // 📮 Pin Code (India format)
  if (!data.pinCode) {
    errors.push("Pin code is required");
  } else if (!/^\d{6}$/.test(data.pinCode)) {
    errors.push("Invalid pin code");
  }

  // 👥 Participants
  if (data.totalParticipants == null) {
    errors.push("Total participants is required");
  } else if (isNaN(data.totalParticipants) || data.totalParticipants <= 0) {
    errors.push("Total participants must be a valid number");
  }

  // 🏢 Proposed Wing
  if (!data.proposedWing) {
    errors.push("Proposed wing is required");
  }

  // 👤 Authority Role
  if (!data.authorityRole) {
    errors.push("Authority role is required");
  }

  // 👨 Authority Person
  if (!data.authorityPersonName) {
    errors.push("Authority person name is required");
  }

  // 📞 Authority Contact
  if (!data.authorityContact) {
    errors.push("Authority contact is required");
  } else if (!/^[6-9]\d{9}$/.test(data.authorityContact)) {
    errors.push("Invalid authority contact number");
  }

  // 🏞️ Playground (Boolean)
  if (typeof data.playgroundAvailable !== "boolean") {
    errors.push("Playground availability must be true or false");
  }

  // 🤝 Coordinator Name
  if (!data.coordinatorName) {
    errors.push("Coordinator name is required");
  }

  // 📞 Coordinator Number
  if (!data.coordinatorNumber) {
    errors.push("Coordinator number is required");
  } else if (!/^[6-9]\d{9}$/.test(data.coordinatorNumber)) {
    errors.push("Invalid coordinator number");
  }
  const isAgreementSigned = data.isAgreementSigned === true;
  // 📝 Agreement Signed (Required Checkbox)
  if (!data.isAgreementSigned) {
    errors.push("You must accept the agreement to proceed");
  }

  return errors;
};