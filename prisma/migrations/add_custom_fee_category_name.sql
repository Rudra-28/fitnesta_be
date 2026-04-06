-- Add custom_category_name to fee_structures
-- Allows admin to create named custom fee tiers for society and school

ALTER TABLE fee_structures
  ADD COLUMN custom_category_name VARCHAR(100) NULL AFTER society_category,
  DROP INDEX uq_fee,
  ADD UNIQUE KEY uq_fee (activity_id, coaching_type, society_category, custom_category_name, standard, term_months);
