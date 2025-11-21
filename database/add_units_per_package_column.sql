-- ============================================================================
-- Script para agregar la columna units_per_package a la tabla products
-- ============================================================================
-- 
-- Este script agrega la columna units_per_package si no existe
-- Uso: mysql -u root -p rfid_stock_db < database/add_units_per_package_column.sql
-- ============================================================================

USE rfid_stock_db;

-- Verificar si la columna existe y agregarla si no existe
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'units_per_package';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Columna existe, no hacer nada
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT 1 COMMENT ''Unidades por caja/paquete (ej: 10 pastillas por caja)''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verificar que se agregó correctamente
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'rfid_stock_db'
  AND TABLE_NAME = 'products'
  AND COLUMN_NAME = 'units_per_package';

