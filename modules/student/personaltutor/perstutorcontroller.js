const service = require("./perstutorservice");
const { validatePersonalTutor } = require("./validatepersonaltutor");
const { validateParentConsent } = require("./validateparentconsent");

/**
 * PHASE 1: Pre-Registration
 * Triggered when the user clicks "Proceed to Payment" 
 * after filling both the Tutor and Consent forms.
 */
exports.submitRegistration = async (req, res) => {
  try {
      // If a file was uploaded for signature, append its path to the body
      if (req.files && req.files.signatureUrl && req.files.signatureUrl.length > 0) {
          req.body.signatureUrl = req.files.signatureUrl[0].path;
      }

      const formData = req.body;
      const serviceType = 'personal_tutor';

      const errors1 = validatePersonalTutor(formData);
      const errors2 = validateParentConsent(formData);

      const errors = [...errors1, ...errors2];

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          errors
        });
      }

      // 1. "Park" the data in pending_registrations first
      const tempUuid = await service.initiateRegistration(formData, serviceType);

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





// const service = require("./perstutorservice");

// // Renamed to match the route's expectation: submitRegistration
// exports.submitRegistration = async (req, res) => {
//   try {
//     // Note: If you're using verifyToken middleware, use req.user.id. 
//     // If it's a new user registration, you might not have a userId yet.
//     const userId = req.user ? req.user.id : null; 
    
//     const result = await service.registerPersonalTutor(req.body, userId);

//     res.status(201).json({
//       success: true,
//       message: "Personal Tutor registration completed successfully",
//       data: result
//     });
//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// // Added the missing Autofill function
// exports.getAutofillData = async (req, res) => {
//   try {
//     const data = await service.getAutofillData(req.params.userId);
//     res.status(200).json({ success: true, data });
//   } catch (error) {
//     res.status(400).json({ success: false, message: error.message });
//   }
// };


