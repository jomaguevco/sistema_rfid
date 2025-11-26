-- ============================================================================
-- Script para agregar campos de formato institucional a recetas médicas
-- Ejecutar: mysql -u root -p rfid_stock_db < add_prescription_format_fields.sql
-- ============================================================================

-- Agregar campo service_type a tabla doctors
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) DEFAULT 'Farmacia Consulta Externa' 
AFTER specialty;

-- Agregar campos a tabla prescriptions
ALTER TABLE prescriptions 
ADD COLUMN IF NOT EXISTS specialty VARCHAR(100) DEFAULT NULL AFTER doctor_license,
ADD COLUMN IF NOT EXISTS service VARCHAR(100) DEFAULT 'Farmacia Consulta Externa' AFTER specialty,
ADD COLUMN IF NOT EXISTS attention_type VARCHAR(50) DEFAULT 'Consulta Externa' AFTER service,
ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(50) DEFAULT NULL AFTER attention_type,
ADD COLUMN IF NOT EXISTS patient_phone VARCHAR(20) DEFAULT NULL AFTER patient_id_number;

-- Agregar campos a tabla prescription_items
ALTER TABLE prescription_items 
ADD COLUMN IF NOT EXISTS administration_route VARCHAR(50) DEFAULT 'Oral' AFTER instructions,
ADD COLUMN IF NOT EXISTS dosage VARCHAR(100) DEFAULT NULL AFTER administration_route,
ADD COLUMN IF NOT EXISTS duration VARCHAR(100) DEFAULT NULL AFTER dosage,
ADD COLUMN IF NOT EXISTS item_code VARCHAR(50) DEFAULT NULL AFTER duration;

-- Crear índice para búsqueda por número de comprobante
CREATE INDEX IF NOT EXISTS idx_prescriptions_receipt_number ON prescriptions(receipt_number);

-- Actualizar recetas existentes con número de comprobante generado automáticamente
UPDATE prescriptions 
SET receipt_number = CONCAT('ORD-', LPAD(id, 7, '0'))
WHERE receipt_number IS NULL;

-- Mostrar resultado
SELECT 'Campos agregados correctamente' AS resultado;

