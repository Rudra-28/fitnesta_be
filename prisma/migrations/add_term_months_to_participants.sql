-- Add term_months to individual_participants and school_students
-- so settlement logic can look up the plan duration per student
-- without querying the payments table at settlement time.

ALTER TABLE individual_participants
    ADD COLUMN term_months TINYINT NOT NULL DEFAULT 1;

ALTER TABLE school_students
    ADD COLUMN term_months TINYINT NOT NULL DEFAULT 9;

ALTER TABLE personal_tutors ADD COLUMN term_months TINYINT NOT NULL DEFAULT 1;
