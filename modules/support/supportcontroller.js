const prisma = require("../../config/prisma");

exports.submitTicket = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { message } = req.body;

        if (!message || !String(message).trim()) {
            return res.status(400).json({ success: false, error: "message is required" });
        }

        const ticket = await prisma.support_tickets.create({
            data: { user_id: userId, message: String(message).trim() },
            select: { id: true, message: true, status: true, created_at: true },
        });

        res.status(201).json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
