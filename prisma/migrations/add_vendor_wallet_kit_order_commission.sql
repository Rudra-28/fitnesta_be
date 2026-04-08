-- Add 'vendor' to commissions_professional_type enum
ALTER TABLE commissions MODIFY COLUMN professional_type ENUM('marketing_executive','trainer','teacher','vendor') NOT NULL;

-- Add 'kit_order' to commissions_source_type enum
ALTER TABLE commissions MODIFY COLUMN source_type ENUM('group_coaching_society','group_coaching_school','group_coaching_other','individual_coaching','personal_tutor','event_ticket','school_registration','kit_order') NOT NULL;
