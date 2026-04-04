ALTER TABLE fee_structures
  ADD COLUMN last_edited_by INT NULL,
  ADD COLUMN last_edited_at TIMESTAMP NULL;
