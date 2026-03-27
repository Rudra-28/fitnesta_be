exports.validateOtherArea = (data) => {
    const errors = [];

    if (!data.mobile || !/^[6-9]\d{9}$/.test(data.mobile))
        errors.push("Valid 10-digit mobile number is required");

    if (!data.sponsorName)
        errors.push("Sponsor name is required");

    if (!data.coordinatorName)
        errors.push("Activity coordinator name is required");

    if (!data.address || data.address.trim().length < 5)
        errors.push("Address is required");

    if (!data.marketingIncharge)
        errors.push("Marketing incharge name is required");

    // Enrollment path extras
    if (data.hasSignedAgreement === true) {
        if (!data.referralCode)
            errors.push("Fitness Coordinator referral code is required for enrollment");
        if (!data.activityAgreementPdf)
            errors.push("Signed agreement document upload is required for enrollment");
    }

    return errors;
};
