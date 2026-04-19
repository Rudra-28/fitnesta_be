-- ── pt_cycle_settlements ─────────────────────────────────────────────────────
-- One row per (personal_tutor record × activity × month-cycle).
-- Created in bulk when sessions are bulk-generated for a personal_tutor student.
-- Pending cycles are recomputed from live session counts on every settlement GET.
-- Settled cycles are frozen (status = 'settled' | 'paid') — counts are not recomputed.
--
-- activity_id FK → activities.id  (resolved from personal_tutors.teacher_for at creation time)
-- personal_tutor_id FK → personal_tutors.id

CREATE TABLE IF NOT EXISTS pt_cycle_settlements (
    id                  INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
    personal_tutor_id   INT            NOT NULL,
    activity_id         INT            NOT NULL,
    cycle_start         DATE           NOT NULL,
    cycle_end           DATE           NOT NULL,
    sessions_allocated  SMALLINT       NOT NULL DEFAULT 0,
    sessions_attended   SMALLINT       NOT NULL DEFAULT 0,
    sessions_absent     SMALLINT       NOT NULL DEFAULT 0,
    sessions_upcoming   SMALLINT       NOT NULL DEFAULT 0,
    base_amount         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    commission_rate     DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
    commission_amount   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    status              ENUM('pending','settled','paid') NOT NULL DEFAULT 'pending',
    settled_at          TIMESTAMP      NULL,
    paid_at             TIMESTAMP      NULL,
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_pt_cycle (personal_tutor_id, activity_id, cycle_start),
    INDEX idx_ptcs_pt_id   (personal_tutor_id),
    INDEX idx_ptcs_act_id  (activity_id),
    INDEX idx_ptcs_status  (status),

    CONSTRAINT fk_ptcs_pt       FOREIGN KEY (personal_tutor_id) REFERENCES personal_tutors(id) ON DELETE CASCADE,
    CONSTRAINT fk_ptcs_activity FOREIGN KEY (activity_id)       REFERENCES activities(id)       ON DELETE RESTRICT
);
