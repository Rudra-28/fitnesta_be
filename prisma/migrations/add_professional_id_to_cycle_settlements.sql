-- Add professional_id to pt_cycle_settlements and ic_cycle_settlements.
--
-- Why: After a teacher/trainer is reassigned, personal_tutors.teacher_professional_id
-- and individual_participants.trainer_professional_id are updated to the NEW professional.
-- Without a professional_id column on the cycle row, the OLD professional can no longer
-- find or settle their own cycles — all settlement and sync queries broke after reassignment.
--
-- Fix: Each cycle row now owns its professional_id directly, so settlement is always
-- scoped to the teacher/trainer who actually taught those sessions, regardless of who
-- the student is currently assigned to.

-- ── pt_cycle_settlements ──────────────────────────────────────────────────────

-- 1. Add the column (nullable first so existing rows don't fail the NOT NULL check)
ALTER TABLE pt_cycle_settlements
    ADD COLUMN professional_id INT NULL AFTER personal_tutor_id;

-- 2. Backfill from the parent personal_tutors record (current teacher on each row)
UPDATE pt_cycle_settlements pcs
JOIN   personal_tutors pt ON pt.id = pcs.personal_tutor_id
SET    pcs.professional_id = pt.teacher_professional_id
WHERE  pcs.professional_id IS NULL;

-- 3. Enforce NOT NULL + FK now that data is populated
ALTER TABLE pt_cycle_settlements
    MODIFY COLUMN professional_id INT NOT NULL,
    ADD CONSTRAINT fk_ptcs_professional
        FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE RESTRICT;

-- 4. Drop the old unique key (was on personal_tutor_id + activity_id + cycle_start)
--    and replace with one that includes professional_id so two teachers can each have
--    a row for the same student + activity + month (split-cycle scenario).
ALTER TABLE pt_cycle_settlements
    DROP INDEX uq_pt_cycle;

ALTER TABLE pt_cycle_settlements
    ADD UNIQUE KEY uq_pt_cycle (personal_tutor_id, professional_id, activity_id, cycle_start);

-- 5. Add index for fast settlement lookups by professional
ALTER TABLE pt_cycle_settlements
    ADD INDEX idx_ptcs_prof_id (professional_id);


-- ── ic_cycle_settlements ──────────────────────────────────────────────────────

ALTER TABLE ic_cycle_settlements
    ADD COLUMN professional_id INT NULL AFTER individual_participant_id;

UPDATE ic_cycle_settlements ics
JOIN   individual_participants ip ON ip.id = ics.individual_participant_id
SET    ics.professional_id = ip.trainer_professional_id
WHERE  ics.professional_id IS NULL;

ALTER TABLE ic_cycle_settlements
    MODIFY COLUMN professional_id INT NOT NULL,
    ADD CONSTRAINT fk_iccs_professional
        FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE RESTRICT;

ALTER TABLE ic_cycle_settlements
    DROP INDEX uq_ic_cycle;

ALTER TABLE ic_cycle_settlements
    ADD UNIQUE KEY uq_ic_cycle (individual_participant_id, professional_id, activity_id, cycle_start);

ALTER TABLE ic_cycle_settlements
    ADD INDEX idx_iccs_prof_id (professional_id);
