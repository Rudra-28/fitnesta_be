// ── Society ──────────────────────────────────────────────────────────────────

exports.validateMeSociety = (data) => {
    const errors = [];

    if (!data.societyUniqueId || data.societyUniqueId.trim().length < 3)
        errors.push("Society unique ID is required (minimum 3 characters)");

    if (!data.societyName)
        errors.push("Society name is required");

    if (!data.societyCategory)
        errors.push("Society category is required");

    if (!data.address || data.address.trim().length < 5)
        errors.push("Address is required");

    if (!data.pinCode || !/^\d{6}$/.test(data.pinCode))
        errors.push("Valid 6-digit pin code is required");

    if (data.totalParticipants == null || isNaN(data.totalParticipants) || Number(data.totalParticipants) <= 0)
        errors.push("Total participants must be a valid positive number");

    if (data.noOfFlats == null || isNaN(data.noOfFlats) || Number(data.noOfFlats) <= 0)
        errors.push("Number of flats must be a valid positive number");

    if (!data.proposedWing)
        errors.push("Proposed wing is required");

    if (!data.authorityRole)
        errors.push("Authority role is required");

    if (!data.authorityPersonName)
        errors.push("Authority person name is required");

    if (!data.contactNumber || !/^[6-9]\d{9}$/.test(data.contactNumber))
        errors.push("Valid 10-digit contact number is required");

    if (![true, false].includes(data.playgroundAvailable))
        errors.push("Playground availability must be true or false");

    return errors;
};

// ── School ───────────────────────────────────────────────────────────────────

exports.validateMeSchool = (data) => {
    const errors = [];

    if (!data.schoolName || data.schoolName.trim().length < 3)
        errors.push("School name is required (minimum 3 characters)");

    if (!data.address || data.address.trim().length < 5)
        errors.push("Address is required");

    if (!data.pinCode || !/^\d{6}$/.test(data.pinCode))
        errors.push("Valid 6-digit pin code is required");

    if (!data.state)
        errors.push("State is required");

    if (!data.principalName)
        errors.push("Principal name is required");

    if (!data.principalContact || !/^[6-9]\d{9}$/.test(data.principalContact))
        errors.push("Valid 10-digit principal contact number is required");

    return errors;
};
