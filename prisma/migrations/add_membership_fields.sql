-- Add membership tracking fields to individual_participants
ALTER TABLE individual_participants
  ADD COLUMN membership_start_date DATE NULL,
  ADD COLUMN membership_end_date   DATE NULL,
  ADD COLUMN session_cap           TINYINT NULL,
  ADD COLUMN session_days_of_week  JSON NULL,
  ADD COLUMN session_start_time    TIME NULL,
  ADD COLUMN session_end_time      TIME NULL,
  ADD COLUMN is_active             TINYINT(1) NOT NULL DEFAULT 1;

-- Add membership tracking fields to personal_tutors
ALTER TABLE personal_tutors
  ADD COLUMN membership_start_date DATE NULL,
  ADD COLUMN membership_end_date   DATE NULL,
  ADD COLUMN session_cap           TINYINT NULL,
  ADD COLUMN session_days_of_week  JSON NULL,
  ADD COLUMN session_start_time    TIME NULL,
  ADD COLUMN session_end_time      TIME NULL,
  ADD COLUMN is_active             TINYINT(1) NOT NULL DEFAULT 1;
