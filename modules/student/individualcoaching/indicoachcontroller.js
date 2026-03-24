const service = require("./indicoachservice");

function toYYYYMMDD(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed) ? null : parsed.toISOString().split('T')[0];
}

exports.submitRegistration = async (req, res) => {
  try {
    let { formData, serviceType } = req.body;

    if (typeof formData === 'string') {
      try {
        formData = JSON.parse(formData);
      } catch (e) {
        throw new Error("Invalid formData JSON format");
      }
    } else if (!formData || Object.keys(formData).length === 0) {
      formData = { ...req.body };
    }

    if (!serviceType) {
      serviceType = formData.serviceType || 'individual_coaching';
    }
    delete formData.serviceType;

    // Capture signature file
    const signatureFile = (req.files?.['signatureUrl'] && req.files['signatureUrl'][0]) ||
      (req.files?.['signature_url'] && req.files['signature_url'][0]) ||
      req.file;

    // Normalize dates on the flat formData BEFORE restructuring
    formData.dob = toYYYYMMDD(formData.dob);
    formData.consent_date = toYYYYMMDD(formData.consent_date);

    // Group flat fields into nested structure
    if (formData && !formData.user_info) {
      formData = {
        user_info: {
          fullName: formData.fullName || formData.participantName || formData.full_name,
          contactNumber: formData.contactNumber || formData.mobile || formData.contact_number
        },
        individualcoaching: {
          flat_no: formData.flat_no,
          dob: formData.dob,
          age: formData.age,
          society_name: formData.society_name,
          activities: formData.activities || formData.activity_enrolled,
          kit_type: formData.kit_type || formData.kits || formData.Kit_type
        },
        consentDetails: {
          society_name: formData.society_name,
          parentName: formData.parentName || formData.parent_name,
          emergencyContactNo: formData.emergencyContactNo || formData.emergency_contact_no,
          activity_enrolled: formData.activity_enrolled,
          consent_date: formData.consent_date,
          signatureUrl: formData.signatureUrl || formData.signature_url
        }
      };
    }

    if (signatureFile) {
      if (!formData.consentDetails) formData.consentDetails = {};
      formData.consentDetails.signatureUrl = signatureFile.path.replace(/\\/g, "/");
    }

    console.log("PHASE 1: Initiating individual coaching registration for:",
      formData.user_info?.fullName || formData.user_info?.contactNumber);

    const tempUuid = await service.initiateRegistration(formData, serviceType);
    console.log("Registration parked. Temp UUID:", tempUuid);

    res.status(200).json({
      success: true,
      message: "Data stored in Cached Memory Successfully. Awaiting payment confirmation.",
      temp_uuid: tempUuid,
    });
  } catch (error) {
    console.error("PHASE 1 Error (initiateRegistration):", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.handlePaymentWebhook = async (req, res) => {
  try {
    const { temp_uuid, payment_id } = req.body;
    console.log("PHASE 2: Webhook received. Temp UUID:", temp_uuid, "Payment ID:", payment_id);

    if (!temp_uuid) {
      console.warn("Webhook received without temp_uuid");
      return res.status(400).send("No UUID provided in metadata");
    }

    const result = await service.finalizeRegistration(temp_uuid, payment_id);
    console.log("Registration finalized for User ID:", result.userId);

    res.status(200).json({
      success: true,
      message: "Webhook processed. Tables updated.",
      userId: result.userId
    });
  } catch (error) {
    console.error("Webhook Logic Error:", error);
    res.status(200).send("Error logged; manual intervention may be required.");
  }
};

const jwt = require('jsonwebtoken');

exports.checkRegistrationStatus = async (req, res) => {
  try {
    const { temp_uuid } = req.params;
    console.log("Checking status for Temp UUID:", temp_uuid);
    const registration = await service.getRegistrationStatus(temp_uuid);

    if (registration.status === 'completed') {
      console.log("Registration completed for Temp UUID:", temp_uuid, ". Generating JWT.");
      const token = jwt.sign(
        { id: registration.userId, role: 'student' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '7d' }
      );
      res.status(200).json({
        success: true,
        isCompleted: true,
        token: token,
        userId: registration.userId
      });
    } else {
      console.log("Registration still pending for Temp UUID:", temp_uuid);
      res.status(200).json({ success: true, isCompleted: false });
    }
  } catch (error) {
    console.error("Status Check Error:", error);
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.mockPayment = async (req, res) => {
  try {
    const { temp_uuid } = req.body;
    console.log("Mocking payment for Temp UUID:", temp_uuid);

    const result = await service.finalizeRegistration(temp_uuid);
    console.log("Mock payment finalized for User ID:", result.userId);

    res.status(200).json({
      success: true,
      message: "Manual payment mock successful",
      data: result
    });
  } catch (error) {
    console.error("Mock Payment Error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};