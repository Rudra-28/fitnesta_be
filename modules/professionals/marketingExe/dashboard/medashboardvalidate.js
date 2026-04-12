// ── Society ──────────────────────────────────────────────────────────────────

exports.validateMeSociety = (data) => {
    const errors = [];

    if (!data.societyUniqueId || data.societyUniqueId.trim().length < 3)
        errors.push("Society unique ID is required (minimum 3 characters)");

    if (!data.societyName)
        errors.push("Society name is required");

    if (!data.societyCategory)
        errors.push("Society category is required");

    if (data.societyCategory === "custom" && !data.customCategoryName?.trim())
        errors.push("Custom category name is required when society category is custom");

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

// ── Visiting Form ─────────────────────────────────────────────────────────────

const PLACE_TYPES = ["society", "school", "organisation"];
const PERMISSION_STATUSES = ["granted", "not_granted", "follow_up"];
const MOBILE_RE = /^[6-9]\d{9}$/;

exports.validateVisitingForm = (data) => {
    const errors = [];

    if (!data.visitDate)
        errors.push("Visit date is required");

    if (!data.visitedPlace || data.visitedPlace.trim().length < 2)
        errors.push("Visited place is required");

    if (!PLACE_TYPES.includes(data.placeType))
        errors.push(`Place type must be one of: ${PLACE_TYPES.join(", ")}`);

    if (!data.placeName || data.placeName.trim().length < 2)
        errors.push("Place name is required");

    if (!data.address || data.address.trim().length < 5)
        errors.push("Address is required");

    if (!data.contactPerson || data.contactPerson.trim().length < 2)
        errors.push("Contact person name is required");

    if (!data.mobileNo || !MOBILE_RE.test(data.mobileNo))
        errors.push("Valid 10-digit mobile number is required");

    if (data.placeType === "society") {
        if (!data.secretaryName)
            errors.push("Secretary name is required for society");
        if (!data.secretaryMobile || !MOBILE_RE.test(data.secretaryMobile))
            errors.push("Valid 10-digit secretary mobile is required for society");
    }

    if (data.placeType === "school") {
        if (!data.principalName)
            errors.push("Principal name is required for school");
        if (!data.principalMobile || !MOBILE_RE.test(data.principalMobile))
            errors.push("Valid 10-digit principal mobile is required for school");
    }

    if (data.placeType === "organisation") {
        if (!data.chairmanName)
            errors.push("Chairman name is required for organisation");
        if (!data.chairmanMobile || !MOBILE_RE.test(data.chairmanMobile))
            errors.push("Valid 10-digit chairman mobile is required for organisation");
    }

    if (!PERMISSION_STATUSES.includes(data.permissionStatus))
        errors.push(`Permission status must be one of: ${PERMISSION_STATUSES.join(", ")}`);

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
