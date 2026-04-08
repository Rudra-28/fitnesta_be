-- ── Step 1: Add activity_category to activities ───────────────────────────
ALTER TABLE activities
    ADD COLUMN activity_category ENUM('sports', 'non_sports') NOT NULL DEFAULT 'sports';

-- Set based on known activity IDs
-- Society Sports + School Sports + Individual Coaching (sports activities)
UPDATE activities SET activity_category = 'sports'
    WHERE id IN (1,2,3,4,5,10,11,12,13,14,15,23,24);

-- Society Non-Sports + School Non-Sports + Personal Tutor subjects
UPDATE activities SET activity_category = 'non_sports'
    WHERE id IN (6,7,8,9,16,17,18,19,20,21,22,25,26);

-- ── Step 2: Insert 6 new session cap commission rules ─────────────────────
INSERT INTO commission_rules (rule_key, professional_type, description, rule_type, value)
VALUES
  ('group_society_sports_sessions_cap',     'trainer', 'Standard monthly sessions cap for society sports batches (5 days/week)',          'cap',  20),
  ('group_society_non_sports_sessions_cap', 'trainer', 'Standard monthly sessions cap for society non-sports batches (3 days/week)',      'cap',  15),
  ('group_school_sports_sessions_cap',      'trainer', 'Standard monthly sessions cap for school sports batches (4 days/week)',           'cap',  18),
  ('group_school_non_sports_sessions_cap',  'trainer', 'Standard monthly sessions cap for school non-sports batches (3 days/week)',       'cap',  15),
  ('individual_coaching_sessions_cap',      'trainer', 'Standard monthly sessions cap for individual coaching (4 days/week)',             'cap',  18),
  ('personal_tutor_sessions_cap',           'teacher', 'Standard monthly sessions cap for personal tutor sessions (4 days/week)',         'cap',  18)
ON DUPLICATE KEY UPDATE value = VALUES(value);
