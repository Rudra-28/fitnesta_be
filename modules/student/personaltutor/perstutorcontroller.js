const service = require("./perstutorservice");
const { validatePersonalTutor } = require("./validatepersonaltutor");
const { validateParentConsent } = require("./validateparentconsent");

function toYYYYMMDD(dateStr) {
    if (!dateStr) return null;
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Handle DD/MM/YYYY from frontend
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
    }
    // Fallback: let JS parse it and reformat
    const parsed = new Date(dateStr);
    return isNaN(parsed) ? null : parsed.toISOString().split('T')[0];
}

exports.submitRegistration = async (req, res) => {
  try {
      let formData = req.body.formData;
      let serviceType = req.body.serviceType || 'personal_tutor';

      // 1. Handle Multipart/Stringified JSON
      if (typeof formData === 'string') {
          try {
              formData = JSON.parse(formData);
          } catch (e) {
              return res.status(400).json({ success: false, message: "Invalid formData JSON format" });
          }
      } else if (!formData || Object.keys(formData).length === 0) {
          // If formData is missing, assume req.body contains the fields directly
          formData = { ...req.body };
      }

    console.log("📦 Parsed formData:", JSON.stringify(formData, null, 2));
    console.log("📎 Files received:", req.files);

      // 2. Normalize and Map Fields (for validation and grouping)
      const normalizedData = {
          fullName: formData.fullName || formData.full_name || formData.participant_name,
          contactNumber: formData.contactNumber || formData.mobile || formData.contact_number,
          address: formData.address,
          dob: formData.dob,
          standard: formData.standard,
          batch: formData.batch,
          teacherFor: formData.teacherFor || formData.teacher_for,
          // Consent fields
          society_name: formData.society_name || formData.societyName,
          parentName: formData.parentName || formData.parent_name,
          emergencyContactNo: formData.emergencyContactNo || formData.emergency_contact_no,
          activity_enrolled: formData.activity_enrolled || formData.activity,
          consent_date: formData.consent_date || formData.consentDate
      };

      // Normalize dates BEFORE validation is called
        normalizedData.dob = toYYYYMMDD(normalizedData.dob);
        normalizedData.consent_date = toYYYYMMDD(normalizedData.consent_date);


      // 3. Handle File Upload (Signature)
      const signatureFile = (req.files?.['signatureUrl'] && req.files['signatureUrl'][0]) || 
                           (req.files?.['parent_signature_doc'] && req.files['parent_signature_doc'][0]) ||
                           req.file;

      if (signatureFile) {
          normalizedData.signatureUrl = signatureFile.path.replace(/\\/g, "/");
      }

      // 4. Calculate Age & Validate
      const errors1 = validatePersonalTutor(normalizedData);
      
      let errors2 = [];
      const birthDate = new Date(normalizedData.dob);
      const age = !isNaN(birthDate) ? Math.floor((new Date() - birthDate) / (1000 * 60 * 60 * 24 * 365.25)) : 0;

      // Only validate parent consent if age < 18
      if (normalizedData.dob && age < 18) {
          errors2 = validateParentConsent(normalizedData);
      }

      const errors = [...errors1, ...errors2];

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          errors
        });
      }

      // 5. Structure data specifically for the perstutorservice expectations
      const structuredPayload = {
          user_info: {
              fullName: normalizedData.fullName,
              contactNumber: normalizedData.contactNumber,
              address: normalizedData.address
          },
          tutorDetails: {
              dob: normalizedData.dob,
              standard: normalizedData.standard,
              batch: normalizedData.batch,
              teacherFor: normalizedData.teacherFor
          },
          consentDetails: (age < 18) ? {
              society_name: normalizedData.society_name,
              parentName: normalizedData.parentName,
              emergencyContactNo: normalizedData.emergencyContactNo,
              activity_enrolled: normalizedData.activity_enrolled,
              signatureUrl: normalizedData.signatureUrl,
              consent_date: normalizedData.consent_date
          } : null
      };

      // 6. "Park" the data in pending_registrations first
      const tempUuid = await service.initiateRegistration(structuredPayload, serviceType);

      res.status(200).json({
          success: true,
          message: "Data stored in Cached Memory Successfully. Awaiting payment confirmation.",
          temp_uuid: tempUuid,
      });
  } catch (error) {
      res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PHASE 2: Payment Webhook
 * Hit by Razorpay/Stripe/Gateway when payment is successful.
 */
exports.handlePaymentWebhook = async (req, res) => {
    try {
        // The Gateway sends the temp_uuid back in the metadata/notes field
        // Adjust the key name based on your specific gateway (e.g., req.body.payload.payment.entity.notes.temp_uuid)
        const { temp_uuid, payment_id } = req.body; 

        if (!temp_uuid) {
            return res.status(400).send("No UUID provided in metadata");
        }

        // This is where the actual DB hits happen for users, students, tutors, and consent
        const result = await service.finalizeRegistration(temp_uuid, payment_id);

        res.status(200).json({
            success: true,
            message: "Webhook processed. Tables updated.",
            userId: result.userId
        });
    } catch (error) {
        console.error("Webhook Logic Error:", error);
        // We send a 200/OK even on logic error so the Gateway stops retrying, 
        // but we log it for manual fix.
        res.status(200).send("Error logged; manual intervention may be required.");
    }
};

/**
 * PHASE 3: Status Check (For Flutter)
 * After the payment SDK closes, Flutter calls this to get their JWT.
 */
const jwt = require('jsonwebtoken');

exports.checkRegistrationStatus = async (req, res) => {
    try {
        const { temp_uuid } = req.params;
        const registration = await service.getRegistrationStatus(temp_uuid);

        if (registration.status === 'completed') {
            // GENERATE JWT NOW
            const token = jwt.sign(
                { id: registration.userId, role: 'student' },
                process.env.JWT_ACCESS_SECRET,
                { expiresIn: '7d' }
            );

            res.status(200).json({
                success: true,
                isCompleted: true,
                token: token, // Flutter saves this for future authenticated requests
                userId: registration.userId
            });
        } else {
            res.status(200).json({ success: true, isCompleted: false });
        }
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.mockPayment = async (req, res) => {
  try {
      const { temp_uuid } = req.body; // Pass the UUID you got from the first API call
      
      // We manually trigger the "Finalize" logic
      const result = await service.finalizeRegistration(temp_uuid);

      res.status(200).json({
          success: true,
          message: "Manual payment mock successful",
          data: result
      });
  } catch (error) {
      res.status(400).json({ success: false, message: error.message });
  }
};