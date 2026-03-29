const service = require("./indicoachservice");
const jwt = require("jsonwebtoken");
const { verifyWebhookSignature } = require("../../../utils/razorpay");

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
    let { formData, serviceType } = req.body;

    if (typeof formData === "string") {
      try {
        formData = JSON.parse(formData);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid formData JSON" });
      }
    } else if (!formData || Object.keys(formData).length === 0) {
      formData = { ...req.body };
    }

    if (!serviceType) serviceType = formData.serviceType || "individual_coaching";
    delete formData.serviceType;

    const signatureFile =
      (req.files?.["signatureUrl"] && req.files["signatureUrl"][0]) ||
      (req.files?.["signature_url"] && req.files["signature_url"][0]) ||
      req.file;

    formData.dob = toYYYYMMDD(formData.dob);
    formData.consent_date = toYYYYMMDD(formData.consent_date);

    if (formData && !formData.user_info) {
      formData = {
        user_info: {
          fullName: formData.fullName || formData.participantName || formData.full_name,
          contactNumber: formData.contactNumber || formData.mobile || formData.contact_number,
        },
        individualcoaching: {
          flat_no: formData.flat_no,
          dob: formData.dob,
          age: formData.age,
          society_name: formData.society_name,
          activities: formData.activities || formData.activity_enrolled,
          kit_type: formData.kit_type || formData.kits || formData.Kit_type,
        },
        consentDetails: {
          society_name: formData.society_name,
          parentName: formData.parentName || formData.parent_name,
          emergencyContactNo: formData.emergencyContactNo || formData.emergency_contact_no,
          activity_enrolled: formData.activity_enrolled,
          consent_date: formData.consent_date,
          signatureUrl: formData.signatureUrl || formData.signature_url,
        },
        // Payment fields — Flutter must send these so we can look up the fee
        payment: {
          activity_id: formData.activity_id ? parseInt(formData.activity_id) : null,
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
    return res.status(error.status ?? 500).json({ success: false, message: error.message });
  }
};

/**
 * PHASE 2 — Razorpay webhook (payment.captured event).
 *
 * Razorpay POST body structure:
 * {
 *   event: "payment.captured",
 *   payload: {
 *     payment: {
 *       entity: {
 *         id: "pay_xxx",
 *         order_id: "order_xxx",
 *         notes: { temp_uuid: "...", service_type: "..." }
 *       }
 *     }
 *   }
 * }
 *
 * The X-Razorpay-Signature header must match our HMAC-SHA256 of the raw body.
 * Configure this URL in the Razorpay dashboard under Webhooks.
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    if (!verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const entity = req.body?.payload?.payment?.entity;
    const temp_uuid = entity?.notes?.temp_uuid;

    if (!temp_uuid) {
      return res.status(400).json({ success: false, message: "temp_uuid missing from payment notes" });
    }

    // Only finalize on payment.captured; ignore other events silently
    if (req.body.event !== "payment.captured") {
      return res.status(200).json({ received: true });
    }

    await service.finalizeRegistration(temp_uuid);
    return res.status(200).json({ success: true });
  } catch (error) {
    // Return 200 so Razorpay does not keep retrying — error is logged for manual review
    console.error("IC Webhook error:", error);
    return res.status(200).json({ received: true });
  }
};

/**
 * PHASE 3 — Flutter polls this after the Razorpay SDK closes.
 * Returns JWT once the webhook has finalized the registration.
 */
exports.checkRegistrationStatus = async (req, res) => {
  try {
    const { temp_uuid } = req.params;
    const registration = await service.getRegistrationStatus(temp_uuid);

    if (registration.status === "approved") {
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

    return res.status(200).json({ success: true, isCompleted: false, status: registration.status });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
