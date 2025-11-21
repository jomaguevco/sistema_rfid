-- ============================================================================
-- Script SQL simplificado para insertar más medicamentos de ejemplo
-- Este script inserta productos y luego sus lotes de forma directa
-- ============================================================================

USE rfid_stock_db;

-- Obtener IDs de categorías
SET @antibioticos_id = (SELECT id FROM product_categories WHERE name LIKE '%Antibiótico%' LIMIT 1);
SET @analgesicos_id = (SELECT id FROM product_categories WHERE name LIKE '%Analgésico%' LIMIT 1);
SET @antinflamatorios_id = (SELECT id FROM product_categories WHERE name LIKE '%Antinflamatorio%' LIMIT 1);
SET @antisepticos_id = (SELECT id FROM product_categories WHERE name LIKE '%Antiséptico%' LIMIT 1);
SET @insumos_id = (SELECT id FROM product_categories WHERE name LIKE '%Insumo%' LIMIT 1);

-- Usar valores por defecto si no existen
SET @antibioticos_id = IFNULL(@antibioticos_id, 1);
SET @analgesicos_id = IFNULL(@analgesicos_id, 2);
SET @antinflamatorios_id = IFNULL(@antinflamatorios_id, 3);
SET @antisepticos_id = IFNULL(@antisepticos_id, 4);
SET @insumos_id = IFNULL(@insumos_id, 5);

-- ============================================================================
-- INSERTAR PRODUCTOS
-- ============================================================================

-- Antibióticos adicionales
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Eritromicina 500mg', 'Antibiótico macrólido', 'medicamento', 'Eritromicina', '500mg/5mL', 'Tabletas', 'Oral', @antibioticos_id, 10, 0, '2090086', NOW()),
('Doxiciclina 100mg', 'Antibiótico tetraciclina', 'medicamento', 'Doxiciclina', '100mg/5mL', 'Cápsulas', 'Oral', @antibioticos_id, 8, 0, '2090087', NOW()),
('Ciprofloxacino 500mg', 'Antibiótico fluoroquinolona', 'medicamento', 'Ciprofloxacino', '500mg/5mL', 'Tabletas', 'Oral', @antibioticos_id, 12, 0, '2090088', NOW());

-- Analgésicos adicionales
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Tramadol 50mg', 'Analgésico opioide', 'medicamento', 'Tramadol', '50mg/5mL', 'Cápsulas', 'Oral', @analgesicos_id, 15, 0, '2090089', NOW()),
('Naproxeno 500mg', 'Analgésico y antinflamatorio', 'medicamento', 'Naproxeno', '500mg/5mL', 'Tabletas', 'Oral', @analgesicos_id, 10, 0, '2090090', NOW()),
('Ketorolaco 10mg', 'Analgésico no esteroideo', 'medicamento', 'Ketorolaco', '10mg/5mL', 'Tabletas', 'Oral', @analgesicos_id, 8, 0, '2090091', NOW());

-- Antinflamatorios adicionales
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Meloxicam 15mg', 'Antinflamatorio no esteroideo', 'medicamento', 'Meloxicam', '15mg/5mL', 'Tabletas', 'Oral', @antinflamatorios_id, 12, 0, '2090092', NOW()),
('Celecoxib 200mg', 'Antinflamatorio selectivo', 'medicamento', 'Celecoxib', '200mg/5mL', 'Cápsulas', 'Oral', @antinflamatorios_id, 10, 0, '2090093', NOW());

-- Sistema respiratorio
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Salbutamol Inhalador', 'Broncodilatador para asma', 'medicamento', 'Salbutamol', '100mcg', 'Inhalador', 'Inhalatoria', @antisepticos_id, 15, 0, '2090094', NOW()),
('Jarabe para la Tos', 'Expectorante y mucolítico', 'medicamento', 'Guaifenesina', '100mg/5mL', 'Jarabe', 'Oral', @antisepticos_id, 12, 0, '2090095', NOW());

-- Gastrointestinales
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Omeprazol 20mg', 'Inhibidor de la bomba de protones', 'medicamento', 'Omeprazol', '20mg/5mL', 'Cápsulas', 'Oral', @antisepticos_id, 20, 0, '2090096', NOW()),
('Lansoprazol 30mg', 'Protector gástrico', 'medicamento', 'Lansoprazol', '30mg/5mL', 'Cápsulas', 'Oral', @antisepticos_id, 18, 0, '2090097', NOW()),
('Dimenhidrinato 50mg', 'Antiemético y antivertiginoso', 'medicamento', 'Dimenhidrinato', '50mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 10, 0, '2090098', NOW());

-- Tópicos
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Pomada Antibiótica', 'Antibiótico tópico', 'medicamento', 'Neomicina', '0.5%', 'Pomada', 'Tópica', @antibioticos_id, 15, 0, '2090099', NOW()),
('Crema Antifúngica', 'Antifúngico tópico', 'medicamento', 'Clotrimazol', '1%', 'Crema', 'Tópica', @antisepticos_id, 12, 0, '2090100', NOW());

-- Insumos médicos
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Agujas Estériles', 'Agujas estériles desechables de diferentes calibres', 'insumo', NULL, NULL, 'Caja', NULL, @insumos_id, 30, 0, '2090101', NOW()),
('Guantes de Látex', 'Guantes quirúrgicos estériles', 'insumo', NULL, NULL, 'Caja', NULL, @insumos_id, 40, 0, '2090102', NOW()),
('Vendas de Yeso', 'Vendas de yeso para inmovilización', 'insumo', NULL, NULL, 'Rollo', NULL, @insumos_id, 20, 0, '2090103', NOW()),
('Mascarillas Quirúrgicas', 'Mascarillas desechables estériles', 'insumo', NULL, NULL, 'Caja', NULL, @insumos_id, 50, 0, '2090104', NOW()),
('Solución Salina 0.9%', 'Suero fisiológico estéril', 'insumo', NULL, '0.9%', 'Bolsa', NULL, @insumos_id, 25, 0, '2090105', NOW()),
('Alcohol Medicinal 70%', 'Alcohol antiséptico para desinfección', 'insumo', NULL, '70%', 'Botella', NULL, @insumos_id, 30, 0, '2090106', NOW()),
('Algodón Hidrófilo', 'Algodón absorbente para uso médico', 'insumo', NULL, NULL, 'Paquete', NULL, @insumos_id, 35, 0, '2090107', NOW()),
('Esparadrapo', 'Cinta adhesiva médica', 'insumo', NULL, NULL, 'Rollo', NULL, @insumos_id, 40, 0, '2090108', NOW());

-- Diabetes
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Metformina 500mg', 'Antidiabético oral', 'medicamento', 'Metformina', '500mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 15, 0, '2090109', NOW()),
('Glibenclamida 5mg', 'Antidiabético oral', 'medicamento', 'Glibenclamida', '5mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 10, 0, '2090110', NOW());

-- Antihistamínicos
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Loratadina 10mg', 'Antihistamínico', 'medicamento', 'Loratadina', '10mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 12, 0, '2090111', NOW()),
('Cetirizina 10mg', 'Antihistamínico', 'medicamento', 'Cetirizina', '10mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 14, 0, '2090112', NOW());

-- ============================================================================
-- CREAR LOTES PARA CADA PRODUCTO
-- ============================================================================
-- Crear lotes para cada producto insertado (2-4 lotes por producto con el mismo RFID)

-- Función auxiliar: crear lotes para un producto específico
-- Nota: En MySQL, necesitamos hacer esto con múltiples INSERTs o un procedimiento
-- Por simplicidad, vamos a insertar 2-3 lotes para cada producto directamente

-- Lotes para productos con RFID 2090086-2090112
-- (Esto se puede hacer más eficientemente con un script de Node.js)

-- Por ahora, insertamos 2 lotes por producto manualmente usando subconsultas
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
SELECT 
    id,
    CONCAT('LOT-', YEAR(NOW()), '-', LPAD(id, 3, '0'), '-001'),
    DATE_ADD(CURDATE(), INTERVAL (6 + FLOOR(RAND() * 30)) MONTH),
    25 + FLOOR(RAND() * 175),
    rfid_uid,
    CURDATE(),
    NOW()
FROM products 
WHERE rfid_uid IN ('2090086', '2090087', '2090088', '2090089', '2090090', '2090091', 
                   '2090092', '2090093', '2090094', '2090095', '2090096', '2090097', 
                   '2090098', '2090099', '2090100', '2090101', '2090102', '2090103', 
                   '2090104', '2090105', '2090106', '2090107', '2090108', '2090109', 
                   '2090110', '2090111', '2090112')
AND id NOT IN (SELECT DISTINCT product_id FROM product_batches WHERE rfid_uid = products.rfid_uid);

-- Segundo lote
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
SELECT 
    id,
    CONCAT('LOT-', YEAR(NOW()), '-', LPAD(id, 3, '0'), '-002'),
    DATE_ADD(CURDATE(), INTERVAL (12 + FLOOR(RAND() * 24)) MONTH),
    30 + FLOOR(RAND() * 170),
    rfid_uid,
    CURDATE(),
    NOW()
FROM products 
WHERE rfid_uid IN ('2090086', '2090087', '2090088', '2090089', '2090090', '2090091', 
                   '2090092', '2090093', '2090094', '2090095', '2090096', '2090097', 
                   '2090098', '2090099', '2090100', '2090101', '2090102', '2090103', 
                   '2090104', '2090105', '2090106', '2090107', '2090108', '2090109', 
                   '2090110', '2090111', '2090112')
AND (SELECT COUNT(*) FROM product_batches WHERE product_id = products.id) < 2;

-- Tercer lote (para algunos productos)
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
SELECT 
    id,
    CONCAT('LOT-', YEAR(NOW()), '-', LPAD(id, 3, '0'), '-003'),
    DATE_ADD(CURDATE(), INTERVAL (18 + FLOOR(RAND() * 18)) MONTH),
    35 + FLOOR(RAND() * 165),
    rfid_uid,
    CURDATE(),
    NOW()
FROM products 
WHERE rfid_uid IN ('2090086', '2090087', '2090088', '2090089', '2090090', '2090091', 
                   '2090092', '2090093', '2090094', '2090095', '2090096', '2090097', 
                   '2090098', '2090099', '2090100', '2090101', '2090102', '2090103', 
                   '2090104', '2090105', '2090106', '2090107', '2090108', '2090109', 
                   '2090110', '2090111', '2090112')
AND (SELECT COUNT(*) FROM product_batches WHERE product_id = products.id) = 2
AND FLOOR(RAND() * 2) = 1;  -- 50% de probabilidad para tercer lote

-- ============================================================================
-- RESUMEN
-- ============================================================================

SELECT 
    '✅ Resumen de inserción:' AS info,
    COUNT(DISTINCT p.id) as productos_insertados,
    COUNT(pb.id) as lotes_creados,
    COUNT(DISTINCT pb.rfid_uid) as rfids_unicos
FROM products p
LEFT JOIN product_batches pb ON pb.product_id = p.id
WHERE p.rfid_uid IN ('2090086', '2090087', '2090088', '2090089', '2090090', '2090091', 
                     '2090092', '2090093', '2090094', '2090095', '2090096', '2090097', 
                     '2090098', '2090099', '2090100', '2090101', '2090102', '2090103', 
                     '2090104', '2090105', '2090106', '2090107', '2090108', '2090109', 
                     '2090110', '2090111', '2090112');

SELECT '✅ Script completado. Medicamentos adicionales insertados exitosamente.' AS resultado;

