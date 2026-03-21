const service = require("./indicoachservice");

/**
 * PHASE 1: Pre-Registration
 * Triggered when the user clicks "Proceed to Payment" 
 * after filling both the Tutor and Consent forms.
 */
exports.submitRegistration = async (req, res) => {
  try {
      const { formData, serviceType } = req.body;

      // 1. "Park" the data in pending_registrations first
      const tempUuid = await service.initiateRegistration(formData, serviceType);

      // 2. MOCK SUCCESS: Immediately call the finalize function
      // In a real app, this happens via the Webhook later.
      //const result = await service.finalizeRegistration(tempUuid);

      res.status(200).json({
          success: true,
          message: "Data stored in Cached Memory Successfully. Awaiting payment confirmation.",
          temp_uuid: tempUuid,
           // This will be the real ID created in your users table
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
        res.status(200).send("Error logged; manual intervention may be required.");
    }
};

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



