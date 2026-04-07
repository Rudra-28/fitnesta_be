-- Add entity_id to commissions table
-- Stores the society_id or school_id for group admission commissions (on_hold rows).
-- Allows per-entity threshold release instead of releasing all held commissions for an ME at once.

ALTER TABLE commissions
  ADD COLUMN entity_id INT NULL AFTER source_id;
