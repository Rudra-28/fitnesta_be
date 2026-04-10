const prisma = require("../../config/prisma");

exports.getLegalContent = async (req, res) => {
    try {
        const { dashboard_type, content_type } = req.query;
        const where = {};
        if (dashboard_type) where.dashboard_type = dashboard_type;
        if (content_type)   where.content_type   = content_type;

        const data = await prisma.legal_content.findMany({
            where,
            orderBy: [{ dashboard_type: "asc" }, { content_type: "asc" }],
            select: { id: true, dashboard_type: true, content_type: true, content: true, updated_at: true },
        });

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

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
