const db = require("../config/db"); // Adjust if your config is one level up

exports.verifyMobileUnique = async (req, res, next) => {
    try {
        // This covers both field names: 'contactNumber' or 'mobile' across possible body structures
        const mobile = req.body?.contactNumber || 
                       req.body?.mobile || 
                       req.body?.formData?.contactNumber || 
                       req.body?.formData?.mobile;

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required."
            });
        }

        // Query the 'users' table directly since all roles (teacher/trainer) are there
        const [rows] = await db.execute(
            "SELECT id FROM users WHERE mobile = ? LIMIT 1",
            [mobile]
        );

        if (rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: "This mobile number is already registered. Please login or use another number."
            });
        }

        next(); // Everything is fine, proceed to the controller
    } catch (error) {
        console.error("Duplicate Check Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error during validation."
        });
    }
};