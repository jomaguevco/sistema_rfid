-- ============================================================================
-- Script para agregar columna doctor_id a tabla prescriptions
-- Ejecutar: mysql -u root -p rfid_stock_db < add_doctor_id_column.sql
-- ============================================================================

-- Agregar columna doctor_id a prescriptions
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS doctor_id INT DEFAULT NULL AFTER doctor_name;

-- Agregar índice para mejorar performance de JOINs
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);

-- Agregar foreign key (opcional, comentado por si hay datos inconsistentes)
-- ALTER TABLE prescriptions 
-- ADD CONSTRAINT fk_prescriptions_doctor 
-- FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL;

-- Actualizar doctor_id basándose en doctor_name o doctor_license existentes
UPDATE prescriptions p
LEFT JOIN doctors d ON p.doctor_name = d.name OR p.doctor_license = d.license_number
SET p.doctor_id = d.id
WHERE p.doctor_id IS NULL AND d.id IS NOT NULL;

SELECT 'Columna doctor_id agregada correctamente' AS resultado;

