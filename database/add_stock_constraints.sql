-- ============================================================================
-- Script para agregar constraints de validación de stock
-- Previene cantidades negativas y mejora la integridad de datos
-- ============================================================================

-- 1. Agregar constraint CHECK para prevenir stock negativo en product_batches
-- ============================================================================

-- Verificar si el constraint ya existe antes de agregarlo
SET @constraint_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_batches'
    AND CONSTRAINT_NAME = 'chk_quantity_non_negative'
);

-- Si no existe, agregarlo
SET @sql = IF(@constraint_exists = 0,
  'ALTER TABLE product_batches ADD CONSTRAINT chk_quantity_non_negative CHECK (quantity >= 0)',
  'SELECT "Constraint chk_quantity_non_negative ya existe" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Agregar constraint CHECK para prevenir valores negativos en stock_history
-- ============================================================================

-- Verificar y agregar constraint para previous_stock
SET @constraint_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_history'
    AND CONSTRAINT_NAME = 'chk_previous_stock_non_negative'
);

SET @sql = IF(@constraint_exists = 0,
  'ALTER TABLE stock_history ADD CONSTRAINT chk_previous_stock_non_negative CHECK (previous_stock >= 0)',
  'SELECT "Constraint chk_previous_stock_non_negative ya existe" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar y agregar constraint para new_stock
SET @constraint_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'stock_history'
    AND CONSTRAINT_NAME = 'chk_new_stock_non_negative'
);

SET @sql = IF(@constraint_exists = 0,
  'ALTER TABLE stock_history ADD CONSTRAINT chk_new_stock_non_negative CHECK (new_stock >= 0)',
  'SELECT "Constraint chk_new_stock_non_negative ya existe" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Verificar datos existentes y corregir inconsistencias
-- ============================================================================

-- Verificar si hay cantidades negativas en product_batches
SELECT 
  COUNT(*) as lotes_con_stock_negativo,
  GROUP_CONCAT(id) as batch_ids
FROM product_batches
WHERE quantity < 0;

-- Verificar si hay inconsistencias en stock_history
SELECT 
  COUNT(*) as registros_con_valores_negativos
FROM stock_history
WHERE previous_stock < 0 OR new_stock < 0;

-- ============================================================================
-- NOTA: Si se encuentran valores negativos, ejecutar los siguientes comandos
-- para corregirlos (descomentar según sea necesario):
-- ============================================================================

-- Corregir cantidades negativas a 0 (solo si es necesario)
-- UPDATE product_batches SET quantity = 0 WHERE quantity < 0;

-- Corregir valores negativos en stock_history (solo si es necesario)
-- UPDATE stock_history SET previous_stock = 0 WHERE previous_stock < 0;
-- UPDATE stock_history SET new_stock = 0 WHERE new_stock < 0;

-- ============================================================================
-- Verificación final
-- ============================================================================

SELECT 
  'Constraints agregados exitosamente' AS status,
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = DATABASE()
     AND TABLE_NAME = 'product_batches'
     AND CONSTRAINT_NAME LIKE 'chk_%') AS constraints_product_batches,
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
   WHERE CONSTRAINT_SCHEMA = DATABASE()
     AND TABLE_NAME = 'stock_history'
     AND CONSTRAINT_NAME LIKE 'chk_%') AS constraints_stock_history;

