-- ============================================================================
-- Sistema de Recetas Médicas
-- ============================================================================
-- 
-- Este archivo agrega las tablas necesarias para el sistema de recetas
-- Uso: mysql -u root -p rfid_stock_db < database/schema_prescriptions.sql
-- ============================================================================

USE rfid_stock_db;

-- Tabla de recetas médicas
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
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (fulfilled_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_prescription_code (prescription_code),
    INDEX idx_patient_name (patient_name),
    INDEX idx_patient_id (patient_id),
    INDEX idx_status (status),
    INDEX idx_prescription_date (prescription_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de items de receta (medicamentos prescritos)
CREATE TABLE IF NOT EXISTS prescription_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prescription_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_required INT NOT NULL COMMENT 'Cantidad requerida de unidades',
    quantity_dispensed INT NOT NULL DEFAULT 0 COMMENT 'Cantidad ya despachada',
    instructions TEXT COMMENT 'Instrucciones de uso (ej: 1 tableta cada 8 horas)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_prescription_id (prescription_id),
    INDEX idx_product_id (product_id),
    INDEX idx_quantity_status (quantity_required, quantity_dispensed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de cumplimiento de despachos (historial detallado)
CREATE TABLE IF NOT EXISTS prescription_fulfillments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prescription_id INT NOT NULL,
    prescription_item_id INT NOT NULL,
    batch_id INT NOT NULL COMMENT 'Lote del que se despachó',
    quantity_dispensed INT NOT NULL COMMENT 'Cantidad despachada en este movimiento',
    dispensed_by INT COMMENT 'Usuario que realizó el despacho',
    dispensed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (dispensed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_prescription_id (prescription_id),
    INDEX idx_prescription_item_id (prescription_item_id),
    INDEX idx_batch_id (batch_id),
    INDEX idx_dispensed_at (dispensed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

