-- ============================================================================
-- Script para eliminar restricción UNIQUE en rfid_uid de product_batches
-- Permite múltiples lotes con el mismo RFID
-- ============================================================================
-- Ejecutar: mysql -u root -p rfid_stock_db < database/fix_rfid_constraint.sql
-- O ejecutar directamente en MySQL:
-- mysql> USE rfid_stock_db;
-- mysql> SOURCE database/fix_rfid_constraint.sql;
-- ============================================================================

USE rfid_stock_db;

-- Verificar índices actuales en rfid_uid
SELECT 
    'Índices actuales en rfid_uid:' AS info,
    INDEX_NAME,
    NON_UNIQUE,
    COLUMN_NAME
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'product_batches' 
AND COLUMN_NAME = 'rfid_uid';

-- Eliminar restricción UNIQUE si existe
-- Intentar diferentes nombres posibles
DROP INDEX IF EXISTS rfid_uid ON product_batches;

-- Si DROP INDEX IF EXISTS no funciona (MySQL < 8.0.13), usar:
-- ALTER TABLE product_batches DROP INDEX rfid_uid;

-- Recrear índice sin restricción UNIQUE
CREATE INDEX idx_rfid_uid ON product_batches(rfid_uid);

-- Verificar resultado
SELECT 
    '✅ Verificación final:' AS info,
    CASE 
        WHEN NON_UNIQUE = 1 THEN '✅ Índice sin restricción UNIQUE (permite duplicados)'
        WHEN NON_UNIQUE = 0 THEN '⚠️  Aún tiene restricción UNIQUE'
        ELSE '❓ Estado desconocido'
    END AS status,
    INDEX_NAME,
    NON_UNIQUE
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'product_batches' 
AND COLUMN_NAME = 'rfid_uid'
LIMIT 1;

SELECT '✅ Script completado. Ahora puedes tener múltiples lotes con el mismo RFID.' AS resultado;

