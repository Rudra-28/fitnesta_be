-- ── ic_cycle_settlements ──────────────────────────────────────────────────────
-- One row per (individual_participant record × month-cycle).
-- individual_coaching has one activity per participant (individual_participants.activity),
-- so no activity sub-split needed — one set of cycles per participant record.
-- activity_id FK → activities.id (resolved from individual_participants.activity name at creation).
-- Pre-created in bulk when sessions are bulk-generated. Pending cycles are
-- live-synced from sessions on every GET. Settled/paid cycles are frozen.

CREATE TABLE IF NOT EXISTS ic_cycle_settlements (
    id                        INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
    individual_participant_id INT            NOT NULL,
    activity_id               INT            NOT NULL,
    cycle_start               DATE           NOT NULL,
    cycle_end                 DATE           NOT NULL,
    sessions_allocated        SMALLINT       NOT NULL DEFAULT 0,
    sessions_attended         SMALLINT       NOT NULL DEFAULT 0,
    sessions_absent           SMALLINT       NOT NULL DEFAULT 0,
    sessions_upcoming         SMALLINT       NOT NULL DEFAULT 0,
    base_amount               DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    commission_rate           DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
    commission_amount         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    status                    ENUM('pending','settled','paid') NOT NULL DEFAULT 'pending',
    settled_at                TIMESTAMP      NULL,
    paid_at                   TIMESTAMP      NULL,
    created_at                TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_ic_cycle (individual_participant_id, activity_id, cycle_start),
    INDEX idx_iccs_ip_id   (individual_participant_id),
    INDEX idx_iccs_act_id  (activity_id),
    INDEX idx_iccs_status  (status),

    CONSTRAINT fk_iccs_ip       FOREIGN KEY (individual_participant_id) REFERENCES individual_participants(id) ON DELETE CASCADE,
    CONSTRAINT fk_iccs_activity FOREIGN KEY (activity_id)               REFERENCES activities(id)             ON DELETE RESTRICT
);
