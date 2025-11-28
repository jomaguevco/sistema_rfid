-- ============================================================================
-- Agregar campo username a la tabla doctors
-- ============================================================================
-- 
-- Este script agrega el campo username a la tabla doctors para poder
-- asignar un nombre de usuario a los médicos
-- Uso: mysql -u root -p rfid_stock_db < database/add_username_to_doctors.sql
-- ============================================================================

USE rfid_stock_db;

-- Agregar columna username si no existe
SET @dbname = DATABASE();
SET @tablename = 'doctors';
SET @columnname = 'username';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(100) UNIQUE COMMENT \'Nombre de usuario del médico\', ADD INDEX idx_doctors_username (', @columnname, ')')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SELECT 'Columna username agregada a la tabla doctors correctamente' AS resultado;
