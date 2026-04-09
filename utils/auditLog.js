const prisma = require("../config/prisma");

/**
 * Record an admin action in the audit_logs table.
 * Fire-and-forget — never throws, never blocks the response.
 *
 * @param {object} req         - Express request (provides req.admin and req.ip)
 * @param {string} action      - Snake_case action name e.g. "approve_registration"
 * @param {object} [meta]      - Optional extra context
 * @param {string} [meta.entity_type]  - Table/domain affected e.g. "pending_registration"
 * @param {number} [meta.entity_id]    - Primary key of the affected row
 * @param {object} [meta.details]      - Any extra JSON context (old value, new value, names, etc.)
 */
const auditLog = (req, action, { entity_type, entity_id, details } = {}) => {
    const adminUserId = req.admin?.userId ?? null;
    const adminName   = req.admin?.name   ?? null;
    const adminScope  = req.admin?.scope  ?? null;
    const ip          = req.ip ?? req.headers?.["x-forwarded-for"] ?? null;

    // Fire and forget — do not await
    prisma.audit_logs.create({
        data: {
            admin_user_id: adminUserId,
            admin_name:    adminName,
            admin_scope:   adminScope,
            action,
            entity_type:   entity_type ?? null,
            entity_id:     entity_id   ?? null,
            details:       details     ?? null,
            ip_address:    ip,
        },
    }).catch((err) => {
        console.error("[auditLog] Failed to write audit log:", err.message);
    });
};

module.exports = auditLog;
