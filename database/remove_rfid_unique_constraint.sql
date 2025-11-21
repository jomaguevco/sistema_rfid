-- ============================================================================
-- Script para eliminar la restricción UNIQUE en rfid_uid de product_batches
-- Esto permite que múltiples lotes compartan el mismo RFID
-- ============================================================================
-- 
-- Uso: mysql -u root -p rfid_stock_db < database/remove_rfid_unique_constraint.sql
-- ============================================================================

USE rfid_stock_db;

-- Eliminar el índice único si existe
-- Nota: El nombre del índice puede variar, intentamos diferentes opciones

-- Opción 1: Intentar eliminar por nombre estándar
SET @index_name = (
    SELECT CONSTRAINT_NAME 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'product_batches' 
    AND CONSTRAINT_TYPE = 'UNIQUE' 
    AND CONSTRAINT_NAME LIKE '%rfid%'
    LIMIT 1
);

SET @sql = IF(@index_name IS NOT NULL, 
    CONCAT('ALTER TABLE product_batches DROP INDEX ', @index_name),
    'SELECT "No se encontró restricción UNIQUE en rfid_uid" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Opción 2: Intentar eliminar directamente si el índice se llama 'rfid_uid'
SET @sql2 = 'ALTER TABLE product_batches DROP INDEX IF EXISTS rfid_uid';
-- Nota: MySQL no soporta DROP INDEX IF EXISTS directamente, así que usamos un bloque condicional

-- Verificar si existe un índice único en rfid_uid
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 
            CONCAT('⚠️  Restricción UNIQUE encontrada: ', GROUP_CONCAT(CONSTRAINT_NAME))
        ELSE 
            '✅ No hay restricción UNIQUE en rfid_uid'
    END AS status
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'product_batches' 
AND CONSTRAINT_TYPE = 'UNIQUE' 
AND CONSTRAINT_NAME LIKE '%rfid%';

-- Recrear el índice sin restricción UNIQUE (si no existe ya)
CREATE INDEX IF NOT EXISTS idx_rfid_uid ON product_batches(rfid_uid);

SELECT '✅ Índice idx_rfid_uid creado/verificado (sin restricción UNIQUE)' AS message;

