-- Add image_url to activities for admin-managed activity images
ALTER TABLE activities
    ADD COLUMN image_url VARCHAR(255) DEFAULT NULL;
