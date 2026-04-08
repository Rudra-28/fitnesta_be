/**
 * FCM Notification Utility
 *
 * sendNotification(userId, title, body, data?)
 *   — looks up the user's fcm_token, sends a push via Firebase Admin SDK.
 *   — silently no-ops if the user has no token (graceful degradation).
 *   — never throws — all errors are logged and swallowed so a failed
 *     notification never breaks the calling business flow.
 *
 * sendNotificationToToken(token, title, body, data?)
 *   — lower-level helper when you already have the token.
 */

const prisma = require("../config/prisma");

// Lazy-load firebase so startup doesn't fail if creds aren't configured yet
let _messaging = null;
function getMessaging() {
    if (!_messaging) {
        const { getAdmin } = require("../config/firebase");
        _messaging = getAdmin().messaging();
    }
    return _messaging;
}

/**
 * Send a notification to a specific FCM token.
 * @param {string} token
 * @param {string} title
 * @param {string} body
 * @param {object} [data]  — key/value string pairs forwarded to the app
 */
async function sendNotificationToToken(token, title, body, data = {}) {
    const message = {
        token,
        notification: { title, body },
        data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: { priority: "high" },
        apns:    { payload: { aps: { sound: "default" } } },
    };

    try {
        await getMessaging().send(message);
    } catch (err) {
        // Token unregistered / app uninstalled — clear it so we stop trying
        if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
        ) {
            await prisma.users.updateMany({
                where: { fcm_token: token },
                data:  { fcm_token: null },
            }).catch(() => {});
        }
        console.error("[FCM] send error:", err.code ?? err.message);
    }
}

/**
 * Send a notification to a user by their user_id.
 * No-ops silently if the user has no fcm_token stored.
 *
 * @param {number} userId
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
async function sendNotification(userId, title, body, data = {}) {
    try {
        const user = await prisma.users.findUnique({
            where:  { id: userId },
            select: { fcm_token: true },
        });
        if (!user?.fcm_token) return;
        await sendNotificationToToken(user.fcm_token, title, body, data);
    } catch (err) {
        console.error("[FCM] lookup error for userId", userId, err.message);
    }
}

module.exports = { sendNotification, sendNotificationToToken };
