const express = require("express");
const router  = express.Router();
const prisma  = require("../../config/prisma");
const { verifyAccessToken } = require("../../middleware/authmiddleware");

const PAGE_SIZE = 20;

/**
 * POST /api/v1/notifications/register-token
 */
router.post("/register-token", verifyAccessToken, async (req, res) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) return res.status(400).json({ success: false, message: "fcm_token is required" });

    await prisma.users.update({
      where: { id: req.user.userId },
      data:  { fcm_token },
    });

    return res.json({ success: true, message: "FCM token registered" });
  } catch (err) {
    console.error("[Notifications] register-token error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/v1/notifications/read-all  ← MUST be before /:id routes
 * Mark all unread notifications for the authenticated user as read.
 */
router.patch("/read-all", verifyAccessToken, async (req, res) => {
  try {
    const { count } = await prisma.notifications.updateMany({
      where: { user_id: req.user.userId, is_read: false },
      data:  { is_read: true },
    });
    return res.json({ success: true, marked_read: count });
  } catch (err) {
    console.error("[Notifications] read-all error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/notifications
 * Paginated notification list for the authenticated user (all roles).
 * Query: ?page=1  ?unread_only=true
 *
 * Response: { success, unread_count, page, has_more, notifications[] }
 */
router.get("/", verifyAccessToken, async (req, res) => {
  try {
    const userId     = req.user.userId;
    const page       = Math.max(1, parseInt(req.query.page) || 1);
    const unreadOnly = req.query.unread_only === "true";

    const where = {
      user_id: userId,
      ...(unreadOnly ? { is_read: false } : {}),
    };

    const [total, unreadCount, rows] = await Promise.all([
      prisma.notifications.count({ where }),
      prisma.notifications.count({ where: { user_id: userId, is_read: false } }),
      prisma.notifications.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip:    (page - 1) * PAGE_SIZE,
        take:    PAGE_SIZE,
        select:  { id: true, title: true, body: true, type: true, data: true, is_read: true, created_at: true },
      }),
    ]);

    return res.json({
      success:       true,
      unread_count:  unreadCount,
      page,
      has_more:      page * PAGE_SIZE < total,
      notifications: rows,
    });
  } catch (err) {
    console.error("[Notifications] list error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read (owner only).
 */
router.patch("/:id/read", verifyAccessToken, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const userId = req.user.userId;

    const notif = await prisma.notifications.findUnique({ where: { id }, select: { user_id: true } });
    if (!notif)                   return res.status(404).json({ success: false, message: "Notification not found" });
    if (notif.user_id !== userId) return res.status(403).json({ success: false, message: "Forbidden" });

    await prisma.notifications.update({ where: { id }, data: { is_read: true } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[Notifications] mark-read error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a single notification (owner only).
 */
router.delete("/:id", verifyAccessToken, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const userId = req.user.userId;

    const notif = await prisma.notifications.findUnique({ where: { id }, select: { user_id: true } });
    if (!notif)                   return res.status(404).json({ success: false, message: "Notification not found" });
    if (notif.user_id !== userId) return res.status(403).json({ success: false, message: "Forbidden" });

    await prisma.notifications.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("[Notifications] delete error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
