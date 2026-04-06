-- ── trainer_assignments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainer_assignments (
    id                  INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    professional_id     INT          NOT NULL,
    professional_type   VARCHAR(20)  NOT NULL COMMENT 'trainer | teacher',
    assignment_type     VARCHAR(30)  NOT NULL COMMENT 'group_coaching_society | group_coaching_school | individual_coaching | personal_tutor',
    society_id          INT          NULL,
    school_id           INT          NULL,
    activity_id         INT          NULL,
    sessions_allocated  TINYINT      NULL,
    assigned_from       DATE         NOT NULL,
    is_active           TINYINT(1)   NOT NULL DEFAULT 1,
    last_settled_at     TIMESTAMP    NULL,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ta_professional FOREIGN KEY (professional_id) REFERENCES professionals(id),
    CONSTRAINT fk_ta_society      FOREIGN KEY (society_id)      REFERENCES societies(id),
    CONSTRAINT fk_ta_school       FOREIGN KEY (school_id)       REFERENCES schools(id),
    CONSTRAINT fk_ta_activity     FOREIGN KEY (activity_id)     REFERENCES activities(id),

    INDEX idx_ta_professional (professional_id),
    INDEX idx_ta_society      (society_id),
    INDEX idx_ta_school       (school_id)
);

-- ── New commission_rules rows ─────────────────────────────────────────────
-- Sessions cap rules (editable by admin via existing commission-rules endpoint)
INSERT IGNORE INTO commission_rules (rule_key, professional_type, description, rule_type, value)
VALUES
    ('trainer_individual_sessions_cap',       'trainer', 'Default sessions allocated per month for individual coaching',  'integer', 20),
    ('teacher_personal_tutor_sessions_cap',   'teacher', 'Default sessions allocated per month for personal tutor',      'integer', 20),
    ('trainer_group_school_rate',             'trainer', 'Trainer commission % for group coaching at schools',           'percentage', 45);
