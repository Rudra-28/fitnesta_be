const db = require("../../config/db");

exports.getAllPending = async (serviceType) => {
    if (serviceType) {
        const [rows] = await db.execute(
            `SELECT id, temp_uuid, service_type, form_data, created_at
             FROM pending_registrations
             WHERE status = 'pending' AND service_type = ?
             ORDER BY created_at DESC`,
            [serviceType]
        );
        return rows;
    }

    const [rows] = await db.execute(
        `SELECT id, temp_uuid, service_type, form_data, created_at
         FROM pending_registrations
         WHERE status = 'pending'
         ORDER BY created_at DESC`
    );
    return rows;
};

exports.getById = async (id) => {
    const [rows] = await db.execute(
        `SELECT * FROM pending_registrations WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0] || null;
};

exports.markReviewed = async (id, status, reviewedBy, note) => {
    await db.execute(
        `UPDATE pending_registrations
         SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [status, reviewedBy, note ?? null, id]
    );
};
