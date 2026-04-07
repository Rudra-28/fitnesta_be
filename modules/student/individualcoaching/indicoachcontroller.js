const service = require("./indicoachservice");
const jwt = require("jsonwebtoken");

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
 * PHASE 1 — Flutter submits the enrollment form.
 *
 * Expected extra fields (on top of existing form fields):
 *   activity_id  {number}  — selected activity's ID from the activities list
 *   term_months  {number}  — 1, 3, or 6
 *   coaching_type {string} — 'individual_coaching' (default) or 'group_coaching'
 *                            (when the form is used for group coaching individual participant)
 *
 * Response: { success, temp_uuid, order_id, amount, currency, key_id }
 * Flutter uses order_id + key_id to open the Razorpay SDK checkout.
 */
exports.submitRegistration = async (req, res) => {
  try {
    console.log("[IC] submitRegistration called");
    let { formData, serviceType } = req.body;

    if (typeof formData === "string") {
      try {
        formData = JSON.parse(formData);
      } catch {
        console.warn("[IC] Failed to parse formData JSON");
        return res.status(400).json({ success: false, message: "Invalid formData JSON" });
      }
    } else if (!formData || Object.keys(formData).length === 0) {
      formData = { ...req.body };
    }

    if (!serviceType) serviceType = formData.serviceType || "individual_coaching";
    delete formData.serviceType;
    console.log(`[IC] serviceType: ${serviceType}, coaching_type: ${formData.coaching_type || "not provided"}`);

    const signatureFile =
      (req.files?.["signatureUrl"] && req.files["signatureUrl"][0]) ||
      (req.files?.["signature_url"] && req.files["signature_url"][0]) ||
      req.file;

    formData.dob = toYYYYMMDD(formData.dob);
    formData.consent_date = toYYYYMMDD(formData.consent_date);

    if (formData && !formData.user_info) {
      // Resolve activity_ids — accept array, JSON string, or repeated fields
      let ids = formData.activity_ids;
      if (typeof ids === "string") {
        try { ids = JSON.parse(ids); } catch { /* keep */ }
      }
      if (typeof ids === "number") ids = [ids];
      if (typeof ids === "string") ids = [Number(ids)];
      if (!Array.isArray(ids) || ids.length === 0) {
        // Fallback to singular activity_id
        ids = formData.activity_id ? [parseInt(formData.activity_id)] : [];
      }
      const activity_ids = ids.map(Number).filter((n) => !isNaN(n) && n > 0);

      // ── Activity debug logs ──────────────────────────────────────────────
      const rawActivities = formData.activities || formData.activity_enrolled;
      const activityList = rawActivities
        ? String(rawActivities).split(",").map((a) => a.trim()).filter(Boolean)
        : [];
      console.log("[IC] activity_ids (for fee lookup):", activity_ids);
      console.log("[IC] activities field (display label):", rawActivities);
      console.log("[IC] activities count:", activityList.length, "| list:", activityList);
      // ────────────────────────────────────────────────────────────────────

      // Resolve term_months — ensure it's an integer
      if (formData.term_months) {
        formData.term_months = parseInt(formData.term_months);
      }

      // society_id is set when student picks a registered society from the dropdown.
      // society_name holds the name in both cases — registered (from dropdown) or
      // unregistered (typed manually). society_id being null is the signal that
      // the society is unregistered; no separate column needed.
      const societyId   = formData.society_id ? parseInt(formData.society_id) : null;
      const societyName = formData.society_name || formData.manually_entered_society || formData.entered_society_name || null;

      const consentSocietyName = societyName;

      formData = {
        user_info: {
          fullName: formData.fullName || formData.participantName || formData.full_name,
          contactNumber: formData.contactNumber || formData.mobile || formData.contact_number,
        },
        individualcoaching: {
          flat_no:    formData.flat_no,
          dob:        formData.dob,
          age:        formData.age,
          society_id: societyId,
          society_name: societyName,
          activities: formData.activities || formData.activity_enrolled,
          kit_type:   formData.kit_type || formData.kits || formData.Kit_type,
          preferred_batch:
      formData.preferred_batch ||
      formData.batch ||
      formData.preferredBatch || null,
          preferred_time: formData.preferred_time || formData.preferredTime || null,
        },
        consentDetails: {
          society_name:       consentSocietyName,
          parentName:         formData.parentName || formData.parent_name,
          emergencyContactNo: formData.emergencyContactNo || formData.emergency_contact_no,
          activity_enrolled:  formData.activity_enrolled,
          consent_date:       formData.consent_date,
          signatureUrl:       formData.signatureUrl || formData.signature_url,
        },
        // Payment fields — Flutter must send these so we can look up the fee
        payment: {
          activity_ids,
          term_months: formData.term_months ? parseInt(formData.term_months) : null,
          coaching_type: formData.coaching_type || serviceType,
        },
      };
    }

    if (signatureFile) {
      if (!formData.consentDetails) formData.consentDetails = {};
      formData.consentDetails.signatureUrl = signatureFile.path.replace(/\\/g, "/");
    }

    const result = await service.initiateRegistration(formData, serviceType);
    console.log(`[IC] Registration parked — temp_uuid: ${result.tempUuid}, order_id: ${result.orderId}, amount: ${result.amount}`);

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
    console.error(`[IC] submitRegistration error: ${error.message}`);
    return res.status(error.status ?? 500).json({ success: false, message: error.message });
  }
};

/**
 * PHASE 3 — Flutter polls this after the Razorpay SDK closes.
 * Returns JWT once the webhook has finalized the registration.
 */
exports.checkRegistrationStatus = async (req, res) => {
  try {
    const { temp_uuid } = req.params;
    console.log(`[IC] checkRegistrationStatus — temp_uuid: ${temp_uuid}`);
    const registration = await service.getRegistrationStatus(temp_uuid);

    if (registration.status === "approved") {
      console.log(`[IC] Registration approved — userId: ${registration.userId}, issuing JWT`);
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
        user: registration.user,
      });
    }

    console.log(`[IC] Registration status: ${registration.status}`);
    return res.status(200).json({ success: true, isCompleted: false, status: registration.status });
  } catch (error) {
    console.error(`[IC] checkRegistrationStatus error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};
