-- ============================================================================
-- Script para agregar lotes y RFID a todos los productos existentes
-- ============================================================================
-- 
-- Este script:
-- 1. Crea un lote para cada producto que no tenga lotes
-- 2. Asigna RFID a algunos productos (no todos)
-- 3. Asegura que todos los productos tengan al menos un lote
--
-- Uso: mysql -u root -p rfid_stock_db < database/add_batches_and_rfid.sql
-- ============================================================================

USE rfid_stock_db;

-- Generar lotes para productos que no tienen
INSERT INTO product_batches (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date)
SELECT 
    p.id as product_id,
    CONCAT('LOT-', LPAD(p.id, 6, '0'), '-', DATE_FORMAT(NOW(), '%Y%m%d')) as lot_number,
    DATE_ADD(NOW(), INTERVAL 365 DAY) as expiry_date,
    COALESCE(p.min_stock * 2, 50) as quantity,
    CASE 
        -- Asignar RFID solo a algunos productos (aproximadamente 70%)
        WHEN p.id % 10 < 7 THEN CONCAT('RFID-', LPAD(p.id, 8, '0'), '-', UPPER(SUBSTRING(MD5(CONCAT(p.id, NOW())), 1, 4)))
        ELSE NULL
    END as rfid_uid,
    CURDATE() as entry_date
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM product_batches pb WHERE pb.product_id = p.id
);

-- Actualizar algunos productos con RFID principal (solo si no tienen)
UPDATE products p
SET rfid_uid = CONCAT('PROD-', LPAD(p.id, 8, '0'), '-', UPPER(SUBSTRING(MD5(CONCAT(p.id, p.name)), 1, 4)))
WHERE p.rfid_uid IS NULL 
  AND p.id % 10 < 5; -- Solo a aproximadamente 50% de los productos

-- Verificar resultados
SELECT 
    COUNT(DISTINCT p.id) as total_productos,
    COUNT(DISTINCT pb.product_id) as productos_con_lotes,
    COUNT(DISTINCT CASE WHEN pb.rfid_uid IS NOT NULL THEN pb.product_id END) as productos_con_rfid_lote,
    COUNT(DISTINCT CASE WHEN p.rfid_uid IS NOT NULL THEN p.id END) as productos_con_rfid_principal
FROM products p
LEFT JOIN product_batches pb ON pb.product_id = p.id;

