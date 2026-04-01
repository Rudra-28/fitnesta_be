exports.validateSociety = (data) => {
    const errors = [];

    if (!data.societyUniqueId || data.societyUniqueId.trim().length < 3)
        errors.push("Society unique ID is required (minimum 3 characters)");

    if (!data.societyName)
        errors.push("Society name is required");

    if (!data.address || data.address.trim().length < 5)
        errors.push("Address is required");

    if (!data.pinCode || !/^\d{6}$/.test(data.pinCode))
        errors.push("Valid 6-digit pin code is required");

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
