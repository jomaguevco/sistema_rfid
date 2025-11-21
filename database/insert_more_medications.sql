-- ============================================================================
-- Script SQL para insertar más medicamentos de ejemplo en la base de datos
-- Incluye múltiples lotes con el mismo RFID para cada medicamento
-- ============================================================================
-- 
-- Uso: mysql -u root -p rfid_stock_db < database/insert_more_medications.sql
-- O ejecutar directamente en MySQL Workbench o cliente MySQL
-- ============================================================================

USE rfid_stock_db;

-- Obtener IDs de categorías (asumiendo que ya existen)
SET @antibioticos_id = (SELECT id FROM product_categories WHERE name LIKE '%Antibiótico%' LIMIT 1);
SET @analgesicos_id = (SELECT id FROM product_categories WHERE name LIKE '%Analgésico%' LIMIT 1);
SET @antinflamatorios_id = (SELECT id FROM product_categories WHERE name LIKE '%Antinflamatorio%' LIMIT 1);
SET @antisepticos_id = (SELECT id FROM product_categories WHERE name LIKE '%Antiséptico%' LIMIT 1);
SET @insumos_id = (SELECT id FROM product_categories WHERE name LIKE '%Insumo%' LIMIT 1);

-- Si no existen categorías, usar NULL (los productos se crearán sin categoría)
SET @antibioticos_id = IFNULL(@antibioticos_id, 1);
SET @analgesicos_id = IFNULL(@analgesicos_id, 2);
SET @antinflamatorios_id = IFNULL(@antinflamatorios_id, 3);
SET @antisepticos_id = IFNULL(@antisepticos_id, 4);
SET @insumos_id = IFNULL(@insumos_id, 5);

-- ============================================================================
-- INSERTAR MEDICAMENTOS ADICIONALES
-- ============================================================================

-- Antibióticos adicionales
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Eritromicina 500mg', 'Antibiótico macrólido', 'medicamento', 'Eritromicina', '500mg/5mL', 'Tabletas', 'Oral', @antibioticos_id, 10, 0, '2090086', NOW()),
('Doxiciclina 100mg', 'Antibiótico tetraciclina', 'medicamento', 'Doxiciclina', '100mg/5mL', 'Cápsulas', 'Oral', @antibioticos_id, 8, 0, '2090087', NOW()),
('Ciprofloxacino 500mg', 'Antibiótico fluoroquinolona', 'medicamento', 'Ciprofloxacino', '500mg/5mL', 'Tabletas', 'Oral', @antibioticos_id, 12, 0, '2090088', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Analgésicos adicionales
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Tramadol 50mg', 'Analgésico opioide', 'medicamento', 'Tramadol', '50mg/5mL', 'Cápsulas', 'Oral', @analgesicos_id, 15, 0, '2090089', NOW()),
('Naproxeno 500mg', 'Analgésico y antinflamatorio', 'medicamento', 'Naproxeno', '500mg/5mL', 'Tabletas', 'Oral', @analgesicos_id, 10, 0, '2090090', NOW()),
('Ketorolaco 10mg', 'Analgésico no esteroideo', 'medicamento', 'Ketorolaco', '10mg/5mL', 'Tabletas', 'Oral', @analgesicos_id, 8, 0, '2090091', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Antinflamatorios adicionales
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Meloxicam 15mg', 'Antinflamatorio no esteroideo', 'medicamento', 'Meloxicam', '15mg/5mL', 'Tabletas', 'Oral', @antinflamatorios_id, 12, 0, '2090092', NOW()),
('Celecoxib 200mg', 'Antinflamatorio selectivo', 'medicamento', 'Celecoxib', '200mg/5mL', 'Cápsulas', 'Oral', @antinflamatorios_id, 10, 0, '2090093', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Medicamentos para sistema respiratorio
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Salbutamol Inhalador', 'Broncodilatador para asma', 'medicamento', 'Salbutamol', '100mcg', 'Inhalador', 'Inhalatoria', @antisepticos_id, 15, 0, '2090094', NOW()),
('Jarabe para la Tos', 'Expectorante y mucolítico', 'medicamento', 'Guaifenesina', '100mg/5mL', 'Jarabe', 'Oral', @antisepticos_id, 12, 0, '2090095', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Medicamentos gastrointestinales
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Omeprazol 20mg', 'Inhibidor de la bomba de protones', 'medicamento', 'Omeprazol', '20mg/5mL', 'Cápsulas', 'Oral', @antisepticos_id, 20, 0, '2090096', NOW()),
('Lansoprazol 30mg', 'Protector gástrico', 'medicamento', 'Lansoprazol', '30mg/5mL', 'Cápsulas', 'Oral', @antisepticos_id, 18, 0, '2090097', NOW()),
('Dimenhidrinato 50mg', 'Antiemético y antivertiginoso', 'medicamento', 'Dimenhidrinato', '50mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 10, 0, '2090098', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Medicamentos tópicos
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Pomada Antibiótica', 'Antibiótico tópico', 'medicamento', 'Neomicina', '0.5%', 'Pomada', 'Tópica', @antibioticos_id, 15, 0, '2090099', NOW()),
('Crema Antifúngica', 'Antifúngico tópico', 'medicamento', 'Clotrimazol', '1%', 'Crema', 'Tópica', @antisepticos_id, 12, 0, '2090100', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Más insumos médicos
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Agujas Estériles', 'Agujas estériles desechables de diferentes calibres', 'insumo', NULL, NULL, 'Caja', NULL, @insumos_id, 30, 0, '2090101', NOW()),
('Guantes de Látex', 'Guantes quirúrgicos estériles', 'insumo', NULL, NULL, 'Caja', NULL, @insumos_id, 40, 0, '2090102', NOW()),
('Vendas de Yeso', 'Vendas de yeso para inmovilización', 'insumo', NULL, NULL, 'Rollo', NULL, @insumos_id, 20, 0, '2090103', NOW()),
('Mascarillas Quirúrgicas', 'Mascarillas desechables estériles', 'insumo', NULL, NULL, 'Caja', NULL, @insumos_id, 50, 0, '2090104', NOW()),
('Solución Salina 0.9%', 'Suero fisiológico estéril', 'insumo', NULL, '0.9%', 'Bolsa', NULL, @insumos_id, 25, 0, '2090105', NOW()),
('Alcohol Medicinal 70%', 'Alcohol antiséptico para desinfección', 'insumo', NULL, '70%', 'Botella', NULL, @insumos_id, 30, 0, '2090106', NOW()),
('Algodón Hidrófilo', 'Algodón absorbente para uso médico', 'insumo', NULL, NULL, 'Paquete', NULL, @insumos_id, 35, 0, '2090107', NOW()),
('Esparadrapo', 'Cinta adhesiva médica', 'insumo', NULL, NULL, 'Rollo', NULL, @insumos_id, 40, 0, '2090108', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Medicamentos para diabetes
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Metformina 500mg', 'Antidiabético oral', 'medicamento', 'Metformina', '500mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 15, 0, '2090109', NOW()),
('Glibenclamida 5mg', 'Antidiabético oral', 'medicamento', 'Glibenclamida', '5mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 10, 0, '2090110', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- Antihistamínicos
INSERT INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
VALUES 
('Loratadina 10mg', 'Antihistamínico', 'medicamento', 'Loratadina', '10mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 12, 0, '2090111', NOW()),
('Cetirizina 10mg', 'Antihistamínico', 'medicamento', 'Cetirizina', '10mg/5mL', 'Tabletas', 'Oral', @antisepticos_id, 14, 0, '2090112', NOW())
ON DUPLICATE KEY UPDATE name=name;

-- ============================================================================
-- CREAR LOTES PARA CADA PRODUCTO (múltiples lotes con el mismo RFID)
-- ============================================================================

-- Función auxiliar para crear lotes (en SQL necesitamos hacerlo con INSERT directos)
-- Crearemos 2-4 lotes por producto con el mismo RFID

-- Nota: Este script inserta lotes para productos que empiezan con ciertos nombres
-- Ajusta los nombres según los productos que realmente se insertaron

DELIMITER $$

-- Crear un procedimiento para generar lotes automáticamente
DROP PROCEDURE IF EXISTS create_batches_for_new_products$$
CREATE PROCEDURE create_batches_for_new_products()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_product_id INT;
    DECLARE v_rfid_uid VARCHAR(50);
    DECLARE v_product_name VARCHAR(255);
    DECLARE batch_counter INT;
    DECLARE lot_date VARCHAR(8);
    DECLARE expiry_offset INT;
    
    DECLARE product_cursor CURSOR FOR 
        SELECT id, rfid_uid, name 
        FROM products 
        WHERE rfid_uid IN ('2090086', '2090087', '2090088', '2090089', '2090090', '2090091', 
                           '2090092', '2090093', '2090094', '2090095', '2090096', '2090097', 
                           '2090098', '2090099', '2090100', '2090101', '2090102', '2090103', 
                           '2090104', '2090105', '2090106', '2090107', '2090108', '2090109', 
                           '2090110', '2090111', '2090112')
        AND id NOT IN (SELECT DISTINCT product_id FROM product_batches WHERE rfid_uid = products.rfid_uid);
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    SET lot_date = DATE_FORMAT(NOW(), '%Y%m%d');
    
    OPEN product_cursor;
    
    read_loop: LOOP
        FETCH product_cursor INTO v_product_id, v_rfid_uid, v_product_name;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Crear 2-4 lotes para cada producto
        SET batch_counter = 0;
        WHILE batch_counter < (2 + FLOOR(RAND() * 3)) DO
            SET expiry_offset = 6 + FLOOR(RAND() * 30); -- 6-36 meses
            
            INSERT INTO product_batches 
                (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
            VALUES (
                v_product_id,
                CONCAT('LOT-', YEAR(NOW()), '-', LPAD(v_product_id, 3, '0'), '-', LPAD(batch_counter + 1, 3, '0')),
                DATE_ADD(CURDATE(), INTERVAL expiry_offset MONTH),
                25 + FLOOR(RAND() * 175), -- 25-200 unidades
                v_rfid_uid,
                CURDATE(),
                NOW()
            )
            ON DUPLICATE KEY UPDATE lot_number=lot_number;
            
            SET batch_counter = batch_counter + 1;
        END WHILE;
        
    END LOOP;
    
    CLOSE product_cursor;
END$$

DELIMITER ;

-- Ejecutar el procedimiento
CALL create_batches_for_new_products();

-- Limpiar el procedimiento
DROP PROCEDURE IF EXISTS create_batches_for_new_products;

-- ============================================================================
-- RESUMEN
-- ============================================================================

SELECT 
    COUNT(DISTINCT p.id) as total_productos_nuevos,
    COUNT(pb.id) as total_lotes_creados,
    COUNT(DISTINCT pb.rfid_uid) as total_rfids_unicos
FROM products p
LEFT JOIN product_batches pb ON pb.product_id = p.id
WHERE p.rfid_uid IN ('2090086', '2090087', '2090088', '2090089', '2090090', '2090091', 
                     '2090092', '2090093', '2090094', '2090095', '2090096', '2090097', 
                     '2090098', '2090099', '2090100', '2090101', '2090102', '2090103', 
                     '2090104', '2090105', '2090106', '2090107', '2090108', '2090109', 
                     '2090110', '2090111', '2090112');

-- Mostrar productos con múltiples lotes
SELECT 
    p.name,
    p.rfid_uid,
    COUNT(pb.id) as num_lotes,
    SUM(pb.quantity) as stock_total
FROM products p
JOIN product_batches pb ON pb.product_id = p.id
WHERE p.rfid_uid IN ('2090086', '2090087', '2090088', '2090089', '2090090', '2090091', 
                     '2090092', '2090093', '2090094', '2090095', '2090096', '2090097', 
                     '2090098', '2090099', '2090100', '2090101', '2090102', '2090103', 
                     '2090104', '2090105', '2090106', '2090107', '2090108', '2090109', 
                     '2090110', '2090111', '2090112')
GROUP BY p.id, p.name, p.rfid_uid
HAVING COUNT(pb.id) > 1
ORDER BY num_lotes DESC, p.name;

