-- ============================================================================
-- Sistema de Doctores y Pacientes
-- ============================================================================
-- 
-- Este archivo agrega las tablas necesarias para doctores y pacientes
-- Uso: mysql -u root -p rfid_stock_db < database/schema_doctors_patients.sql
-- ============================================================================

USE rfid_stock_db;

-- Primero crear la tabla prescriptions si no existe (requerida para las foreign keys)
CREATE TABLE IF NOT EXISTS prescriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prescription_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Código único de receta (ej: REC-2025-001)',
    qr_code TEXT COMMENT 'Código QR generado para la receta',
    patient_name VARCHAR(255) NOT NULL COMMENT 'Nombre del paciente',
    patient_id VARCHAR(100) COMMENT 'DNI o identificación del paciente',
    doctor_name VARCHAR(255) NOT NULL COMMENT 'Nombre del médico que prescribe',
    doctor_license VARCHAR(100) COMMENT 'Número de colegiatura o licencia',
    prescription_date DATE NOT NULL COMMENT 'Fecha de la receta',
    status ENUM('pending', 'partial', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Estado del despacho',
    notes TEXT COMMENT 'Notas adicionales',
    created_by INT COMMENT 'Usuario que creó la receta',
    fulfilled_by INT COMMENT 'Usuario que completó el despacho',
    fulfilled_at TIMESTAMP NULL COMMENT 'Fecha y hora de despacho completo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prescription_code (prescription_code),
    INDEX idx_patient_name (patient_name),
    INDEX idx_patient_id (patient_id),
    INDEX idx_status (status),
    INDEX idx_prescription_date (prescription_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de doctores/médicos
CREATE TABLE IF NOT EXISTS doctors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL COMMENT 'Nombre completo del médico',
    license_number VARCHAR(100) UNIQUE COMMENT 'Número de colegiatura o licencia',
    specialty VARCHAR(255) COMMENT 'Especialidad médica',
    area_id INT COMMENT 'Área/departamento asignado (NULL para medicina general)',
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    INDEX idx_name (name),
    INDEX idx_license_number (license_number),
    INDEX idx_area_id (area_id),
    INDEX idx_specialty (specialty),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de pacientes
CREATE TABLE IF NOT EXISTS patients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL COMMENT 'Nombre completo del paciente',
    id_number VARCHAR(100) UNIQUE COMMENT 'DNI o número de identificación',
    date_of_birth DATE COMMENT 'Fecha de nacimiento',
    gender ENUM('M', 'F', 'O') COMMENT 'Género: Masculino, Femenino, Otro',
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_id_number (id_number),
    INDEX idx_date_of_birth (date_of_birth)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de restricciones de especialidad por producto/área
-- Define qué especialidades pueden recetar qué productos
CREATE TABLE IF NOT EXISTS product_specialty_restrictions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    specialty VARCHAR(255) NOT NULL COMMENT 'Especialidad requerida (ej: Cardiología, Pediatría)',
    area_id INT COMMENT 'Área específica (NULL para todas las áreas)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_specialty_area (product_id, specialty, area_id),
    INDEX idx_product_id (product_id),
    INDEX idx_specialty (specialty),
    INDEX idx_area_id (area_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar columna area_id a productos (verificar si existe primero)
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'area_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT COMMENT \'Área principal del producto (NULL para uso general)\', ADD INDEX idx_products_area_id (', @columnname, '), ADD FOREIGN KEY fk_products_area (', @columnname, ') REFERENCES areas(id) ON DELETE SET NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Agregar columnas a prescriptions
-- Nota: patient_id ya existe como VARCHAR(100) para DNI, lo renombramos a patient_id_number
-- y agregamos un nuevo patient_id como INT para la relación con la tabla patients

-- Renombrar patient_id (VARCHAR) a patient_id_number si existe y no se ha renombrado
SET @tablename = 'prescriptions';
SET @columnname = 'patient_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
      AND (data_type = 'varchar')
  ) > 0
  AND
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'patient_id_number')
  ) = 0,
  CONCAT('ALTER TABLE ', @tablename, ' CHANGE COLUMN ', @columnname, ' patient_id_number VARCHAR(100) COMMENT \'DNI o identificación del paciente\''),
  'SELECT 1'
));
PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

-- Agregar patient_id como INT si no existe
SET @columnname = 'patient_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
      AND (data_type = 'int')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT COMMENT \'ID del paciente (si está registrado)\', ADD INDEX idx_prescriptions_patient_id (', @columnname, '), ADD FOREIGN KEY fk_prescriptions_patient (', @columnname, ') REFERENCES patients(id) ON DELETE SET NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Agregar doctor_id si no existe
SET @columnname = 'doctor_id';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT COMMENT \'ID del médico (si está registrado)\', ADD INDEX idx_prescriptions_doctor_id (', @columnname, '), ADD FOREIGN KEY fk_prescriptions_doctor (', @columnname, ') REFERENCES doctors(id) ON DELETE SET NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
