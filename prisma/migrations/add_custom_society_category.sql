-- Migration: add 'custom' to society_category enums and seed me_group_admission_min_students rule
-- Run this against fitnesta_db before deploying the updated code.

-- 1. Extend the fee_structures.society_category enum and add audit columns
ALTER TABLE fee_structures
  MODIFY COLUMN society_category ENUM('A+', 'A', 'B', 'custom') NULL,
  ADD COLUMN last_edited_by INT NULL,
  ADD COLUMN last_edited_at TIMESTAMP NULL;

-- 2. Extend the societies.society_category enum
ALTER TABLE societies
  MODIFY COLUMN society_category ENUM('A+', 'A', 'B', 'custom') NOT NULL;

-- 3. Add the new commission rule for ME group admission threshold (skip if already exists)
INSERT IGNORE INTO commission_rules (rule_key, professional_type, description, rule_type, value, updated_at)
VALUES (
  'me_group_admission_min_students',
  'marketing_executive',
  'Minimum number of group_coaching students in a society or school required before ME on_hold group coaching commissions are released',
  'flat',
  20.00,
  NOW()
);
