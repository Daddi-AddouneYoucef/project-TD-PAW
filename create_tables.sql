CREATE DATABASE IF NOT EXISTS attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE attendance_db;

CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(50) PRIMARY KEY,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    week INT NOT NULL,
    present TINYINT(1) DEFAULT 0,
    participated TINYINT(1) DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_week (student_id, week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_student_week ON attendance(student_id, week);