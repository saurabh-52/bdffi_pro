-- Phase 1: MySQL schema for Fast Forward India blood-donation automation

CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `admission_no` VARCHAR(50) UNIQUE,
  `phone_no` VARCHAR(20) NOT NULL,
  `blood_group` VARCHAR(5) NOT NULL,
  `last_donation_date` DATE DEFAULT NULL,
  `status` ENUM('active','inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `donation_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_name` VARCHAR(200) NOT NULL,
  `hospital_name` VARCHAR(200) DEFAULT NULL,
  `required_blood_group` VARCHAR(5) NOT NULL,
  `contact_no` VARCHAR(20) DEFAULT NULL,
  `status` ENUM('pending','fulfilled','cancelled') DEFAULT 'pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `notification_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `request_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `status` ENUM('sent','accepted','declined','failed') DEFAULT 'sent',
  `message_id` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (`request_id`),
  INDEX (`student_id`),
  FOREIGN KEY (`request_id`) REFERENCES `donation_requests`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Helpful sample index for common filter
CREATE INDEX IF NOT EXISTS idx_students_blood_lastdonation ON `students` (`blood_group`, `last_donation_date`);

-- Sample seed insert (optional)
INSERT INTO `students` (`name`, `admission_no`, `phone_no`, `blood_group`, `last_donation_date`) VALUES
('Asha Sharma', 'A1001', '+919900000001', 'A+', NULL),
('Ravi Kumar', 'A1002', '+919900000002', 'B+', '2025-12-01');
