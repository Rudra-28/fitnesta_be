const service = require("./schoolstudentservice");
const jwt = require('jsonwebtoken');
const { validateSchoolStudent } = require("./schoolstudentvalidation");
const schoolRepo = require("../../school/schoolrepo");

exports.submitRegistration = async (req, res) => {
  try {
      const formData = req.body;
      const serviceType = 'school_student'; // Hardcoded automatically
      
      const errors = validateSchoolStudent(formData);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, errors });
      }

      // Validate exactly matching School Name and attach its ID
      const school = await schoolRepo.getSchoolByName(formData.schoolName);
      if (!school) {
        return res.status(404).json({ success: false, message: "Selected school does not exist in our system." });
      }
      formData.school_id = school.id;

      const tempUuid = await service.initiateRegistration(formData, serviceType);

      res.status(200).json({
          success: true,
          message: "Data parked. Awaiting payment.",
          temp_uuid: tempUuid,
      });
  } catch (error) {
      res.status(500).json({ success: false, message: error.message });
  }
};

exports.handlePaymentWebhook = async (req, res) => {
    try {
        const { temp_uuid, payment_id } = req.body; 

        if (!temp_uuid) {
            return res.status(400).send("No UUID provided in metadata");
        }

        const result = await service.finalizeRegistration(temp_uuid, payment_id);

        res.status(200).json({
            success: true,
            message: "Webhook processed. Tables updated.",
            userId: result.userId
        });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(200).send("Error logged; manual intervention may be required.");
    }
};

exports.checkRegistrationStatus = async (req, res) => {
    try {
        const { temp_uuid } = req.params;
        const registration = await service.getRegistrationStatus(temp_uuid);

        if (registration.status === 'completed') {
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
            res.status(200).json({ success: true, isCompleted: false });
        }
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

exports.mockPayment = async (req, res) => {
  try {
      const { temp_uuid } = req.body;
      const result = await service.finalizeRegistration(temp_uuid);

      res.status(200).json({
          success: true,
          message: "Mock payment successful",
          data: result
      });
  } catch (error) {
      res.status(400).json({ success: false, message: error.message });
  }
};
