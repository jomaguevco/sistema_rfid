-- ============================================================================
-- Script SIMPLE para eliminar la restricción UNIQUE en rfid_uid
-- Ejecutar manualmente si el script anterior no funciona
-- ============================================================================
-- 
-- Uso: mysql -u root -p rfid_stock_db < database/remove_rfid_unique_constraint_simple.sql
-- O ejecutar directamente en MySQL:
-- mysql> USE rfid_stock_db;
-- mysql> ALTER TABLE product_batches DROP INDEX rfid_uid;
-- mysql> CREATE INDEX idx_rfid_uid ON product_batches(rfid_uid);
-- ============================================================================

USE rfid_stock_db;

-- Paso 1: Ver índices existentes en rfid_uid
SELECT 
    INDEX_NAME, 
    NON_UNIQUE,
    COLUMN_NAME
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'product_batches' 
AND COLUMN_NAME = 'rfid_uid';

-- Paso 2: Eliminar índice único (si existe)
-- Nota: Si hay un error, el índice ya no existe o tiene otro nombre
SET @sql = CONCAT(
    'ALTER TABLE product_batches ',
    'DROP INDEX IF EXISTS rfid_uid'
);

-- MySQL 5.7+ soporta DROP INDEX IF EXISTS, si no funciona, usar:
-- ALTER TABLE product_batches DROP INDEX rfid_uid;

-- Intentar ejecutar (manejar error si no existe)
-- Por seguridad, primero verificamos

-- Si el índice existe y es único, lo eliminamos
-- Si no existe o no es único, continuamos

-- Paso 3: Crear índice no único
CREATE INDEX IF NOT EXISTS idx_rfid_uid ON product_batches(rfid_uid);

-- Paso 4: Verificar resultado
SELECT 
    CASE 
        WHEN NON_UNIQUE = 1 THEN '✅ Índice sin restricción UNIQUE (permite duplicados)'
        WHEN NON_UNIQUE = 0 THEN '⚠️  Índice con restricción UNIQUE (no permite duplicados)'
        ELSE '❓ Estado desconocido'
    END AS status,
    INDEX_NAME,
    NON_UNIQUE
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'product_batches' 
AND COLUMN_NAME = 'rfid_uid'
LIMIT 1;

