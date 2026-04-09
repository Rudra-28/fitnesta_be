ALTER TABLE sessions MODIFY COLUMN status ENUM('scheduled','ongoing','completed','cancelled','absent') DEFAULT 'scheduled';
