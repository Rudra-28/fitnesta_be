exports.validateTrainer = (data) => {
    const errors = [];

    // Helper: parse arrays that arrive as JSON strings from multipart/form-data
    const parseArray = (val) => {
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return val ? [val] : []; }
    };

    // ── Personal Details ────────────────────────────────────────────────────
    if (!data.fullName || data.fullName.trim().length < 3)
        errors.push("Full name must be at least 3 characters");

    if (!data.contactNumber || !/^\d{10}$/.test(data.contactNumber))
        errors.push("Valid 10-digit contact number required");

    if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email))
        errors.push("Valid email address required");

    if (!data.address || data.address.trim().length < 5)
        errors.push("Address is required");

    if (!data.photo)
        errors.push("Photo is required");

    // ── Played Level (single selection) ─────────────────────────────────────
    const validLevels = ["District", "State", "National"];
    if (!data.playerLevel || !validLevels.includes(data.playerLevel))
        errors.push("Played level must be District, State, or National");

    // ── Upload Document (personal doc under personal details) ──────────────
    if (!data.documents)
        errors.push("Document upload is required");

    // ── Category (single selection) ──────────────────────────────────────────
    const validCategories = ["Indoor", "Outdoor"];
    if (!data.category || !validCategories.includes(data.category))
        errors.push("Category must be Indoor or Outdoor");

    // ── Specified Game & Skills ──────────────────────────────────────────────
    const games = parseArray(data.specifiedGame);
    if (games.length === 0)
        errors.push("At least one game must be selected");

    const skills = parseArray(data.specifiedSkills);
    if (skills.length === 0)
        errors.push("At least one skill must be selected");

    // ── Experience Details (optional — no minimum required) ─────────────────
    // No validation — form marks this as optional

    // ── Qualification Details ────────────────────────────────────────────────
    if (!data.qualificationDocs)
        errors.push("Highest qualification certificate is required");

    if (!data.panCard)
        errors.push("PAN card is required");

    if (!data.adharCard)
        errors.push("Aadhaar card is required");

    // ── Relative Info ────────────────────────────────────────────────────────
    if (!data.relativeName || data.relativeName.trim().length < 3)
        errors.push("Relative name must be at least 3 characters");

    if (!data.relativeContact || !/^\d{10}$/.test(data.relativeContact))
        errors.push("Valid 10-digit relative contact number required");

    // ── Own Two Wheeler ──────────────────────────────────────────────────────
    const isValidBool = ['true', 'false', true, false].includes(data.ownTwoWheeler);
    if (!isValidBool)
        errors.push("Own two wheeler selection is required (Yes or No)");

    // ── Communication Language ───────────────────────────────────────────────
    const langs = parseArray(data.communicationLanguages);
    if (langs.length === 0)
        errors.push("At least one communication language is required");

    // ── Place & Date ─────────────────────────────────────────────────────────
    if (!data.place || data.place.trim().length < 2)
        errors.push("Place is required");

    if (!data.date)
        errors.push("Date is required");

    return errors;
};
