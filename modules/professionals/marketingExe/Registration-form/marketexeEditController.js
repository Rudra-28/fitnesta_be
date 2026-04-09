const service = require("./marketexeEditService");

exports.editME = async (req, res) => {
    try {
        console.log(`[Marketing Exec Edit Profile] Request received for User ID: ${req.user.userId}`);
        console.log(`[Marketing Exec Edit Profile] Request Body:`, req.body);
        console.log(`[Marketing Exec Edit Profile] Uploaded Files:`, req.files ? Object.keys(req.files) : 'None');

        const fileData = {};
        if (req.files) {
            if (req.files['photo']) fileData.photo = req.files['photo'][0].path;
        }

        const data = { ...req.body, ...fileData };
        const result = await service.editME(req.user.userId, data);

        console.log(`[Marketing Exec Edit Profile] Successfully updated. Returning Response:`, result);
        res.status(200).json(result);
    } catch (err) {
        console.error("Marketing executive edit profile error:", err.message);
        res.status(400).json({ success: false, error: err.message });
    }
};
