const service = require("./perstutorservice");
const jwt = require("jsonwebtoken");
const { validatePersonalTutor } = require("./validatepersonaltutor");
const { validateParentConsent } = require("./validateparentconsent");

function toYYYYMMDD(dateStr) {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split("/");
        return `${year}-${month}-${day}`;
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed) ? null : parsed.toISOString().split("T")[0];
}

/**
 * PHASE 1 — Flutter submits the personal tutor enrollment form.
 *
 * Extra fields required (on top of existing form fields):
 *   activity_ids  {number[]}  — array of activity IDs for each subject selected
 *   term_months   {number}    — 1 or 3
 *   standard is already part of the form (grade level) — reused for fee lookup
 *
 * Response: { success, temp_uuid, order_id, amount, currency, key_id }
 */
exports.submitRegistration = async (req, res) => {
    try {
        console.log("[PT] submitRegistration called");
        let formData = req.body.formData;
        let serviceType = req.body.serviceType || "personal_tutor";

        if (typeof formData === "string") {
            try {
                formData = JSON.parse(formData);
            } catch {
                console.warn("[PT] Failed to parse formData JSON");
                return res.status(400).json({ success: false, message: "Invalid formData JSON" });
            }
        } else if (!formData || Object.keys(formData).length === 0) {
            formData = { ...req.body };
        }

        const normalizedData = {
            fullName: formData.fullName || formData.full_name || formData.participant_name,
            contactNumber: formData.contactNumber || formData.mobile || formData.contact_number,
            address: formData.address,
            dob: toYYYYMMDD(formData.dob),
            standard: formData.standard,
            batch: formData.batch,
            teacherFor: formData.teacherFor || formData.teacher_for,
            society_name: formData.society_name || formData.societyName,
            parentName: formData.parentName || formData.parent_name,
            emergencyContactNo: formData.emergencyContactNo || formData.emergency_contact_no,
            activity_enrolled: formData.activity_enrolled || formData.activity,
            consent_date: toYYYYMMDD(formData.consent_date || formData.consentDate),
        };

        const signatureFile =
            (req.files?.["signatureUrl"] && req.files["signatureUrl"][0]) ||
            (req.files?.["parent_signature_doc"] && req.files["parent_signature_doc"][0]) ||
            req.file;

        if (signatureFile) {
            normalizedData.signatureUrl = signatureFile.path.replace(/\\/g, "/");
        }

        const errors1 = validatePersonalTutor(normalizedData);
        const birthDate = new Date(normalizedData.dob);
        const age = !isNaN(birthDate)
            ? Math.floor((Date.now() - birthDate) / (1000 * 60 * 60 * 24 * 365.25))
            : 0;

        const errors2 = age < 18 ? validateParentConsent(normalizedData) : [];
        const errors = [...errors1, ...errors2];

        if (errors.length > 0) {
            console.warn("[PT] Validation failed:", errors);
            return res.status(400).json({ success: false, errors });
        }

        // Parse activity_ids — Flutter sends this as multipart field(s)
        // multer gives a string for a single value, an array for repeated fields
        let activity_ids = formData.activity_ids;
        if (typeof activity_ids === "string") {
            // Try JSON parse first (handles "[18]" or "18")
            try { activity_ids = JSON.parse(activity_ids); } catch { /* keep as string */ }
        }
        // After JSON.parse, a bare number like 18 is not an array — wrap it
        if (typeof activity_ids === "number") {
            activity_ids = [activity_ids];
        }
        // Still a plain string (e.g. "18") — wrap it
        if (typeof activity_ids === "string" && activity_ids.trim() !== "") {
            activity_ids = [Number(activity_ids)];
        }
        // Fallback: accept singular activity_id if activity_ids still missing/empty
        if ((!Array.isArray(activity_ids) || activity_ids.length === 0) && formData.activity_id) {
            activity_ids = [formData.activity_id];
        }
        // Ensure all elements are numbers
        if (Array.isArray(activity_ids)) {
            activity_ids = activity_ids.map(Number).filter(n => !isNaN(n));
        }

        const term_months = formData.term_months ? parseInt(formData.term_months) : null;

        const structuredPayload = {
            user_info: {
                fullName: normalizedData.fullName,
                contactNumber: normalizedData.contactNumber,
                address: normalizedData.address,
            },
            tutorDetails: {
                dob: normalizedData.dob,
                standard: normalizedData.standard,
                batch: normalizedData.batch,
                teacherFor: normalizedData.teacherFor,
            },
            consentDetails: age < 18 ? {
                society_name: normalizedData.society_name,
                parentName: normalizedData.parentName,
                emergencyContactNo: normalizedData.emergencyContactNo,
                activity_enrolled: normalizedData.activity_enrolled,
                signatureUrl: normalizedData.signatureUrl,
                consent_date: normalizedData.consent_date,
            } : null,
            // Payment fields for fee lookup
            payment: {
                activity_ids,
                term_months,
                standard: normalizedData.standard,
            },
        };

        const result = await service.initiateRegistration(structuredPayload, serviceType);
        console.log(`[PT] Registration parked — temp_uuid: ${result.tempUuid}, order_id: ${result.orderId}, amount: ${result.amount}`);

        return res.status(200).json({
            success: true,
            message: "Registration parked. Complete payment to confirm.",
            temp_uuid: result.tempUuid,
            order_id: result.orderId,
            amount: result.amount,
            currency: result.currency,
            key_id: result.keyId,
        });
    } catch (error) {
        console.error(`[PT] submitRegistration error: ${error.message}`);
        return res.status(error.status ?? 500).json({ success: false, message: error.message });
    }
};

/**
 * PHASE 3 — Flutter polls this after the Razorpay SDK closes.
 */
exports.checkRegistrationStatus = async (req, res) => {
    try {
        const { temp_uuid } = req.params;
        console.log(`[PT] checkRegistrationStatus — temp_uuid: ${temp_uuid}`);
        const registration = await service.getRegistrationStatus(temp_uuid);

        if (registration.status === "approved") {
            console.log(`[PT] Registration approved — userId: ${registration.userId}, issuing JWT`);
            const token = jwt.sign(
                { id: registration.userId, role: "student" },
                process.env.JWT_ACCESS_SECRET,
                { expiresIn: "7d" }
            );
            return res.status(200).json({
                success: true,
                isCompleted: true,
                token,
                userId: registration.userId,
            });
        }

        console.log(`[PT] Registration status: ${registration.status}`);
        return res.status(200).json({ success: true, isCompleted: false, status: registration.status });
    } catch (error) {
        console.error(`[PT] checkRegistrationStatus error: ${error.message}`);
        return res.status(500).json({ success: false, message: error.message });
    }
};
