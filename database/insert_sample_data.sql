-- Script para insertar datos de ejemplo en el sistema médico
-- Ejecutar después de crear el esquema

USE rfid_stock_db;

-- Limpiar datos existentes (opcional - comentar si no se desea)
-- DELETE FROM stock_history;
-- DELETE FROM consumption_predictions;
-- DELETE FROM stock_alerts;
-- DELETE FROM product_batches;
-- DELETE FROM products;
-- DELETE FROM areas WHERE id > 8;
-- DELETE FROM product_categories WHERE id > 8;

-- ============================================================================
-- INSERTAR PRODUCTOS MÉDICOS DE EJEMPLO
-- ============================================================================

INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration) VALUES
-- Antibióticos
('Amoxicilina 500mg', 'Antibiótico de amplio espectro para el tratamiento de infecciones bacterianas', 'medicamento', 'Amoxicilina', '500mg', 'Cápsulas', 'Oral', 1, 30, FALSE),
('Azitromicina 500mg', 'Antibiótico macrólido para el tratamiento de infecciones respiratorias', 'medicamento', 'Azitromicina', '500mg', 'Tabletas', 'Oral', 1, 25, FALSE),
('Ceftriaxona 1g', 'Antibiótico inyectable de amplio espectro', 'medicamento', 'Ceftriaxona', '1g', 'Vial', 'Intravenosa', 1, 20, TRUE),

-- Analgésicos
('Paracetamol 500mg', 'Analgésico y antipirético para el tratamiento del dolor y la fiebre', 'medicamento', 'Paracetamol', '500mg', 'Tabletas', 'Oral', 2, 50, FALSE),
('Ibuprofeno 400mg', 'Antiinflamatorio no esteroideo para el tratamiento del dolor y la inflamación', 'medicamento', 'Ibuprofeno', '400mg', 'Tabletas', 'Oral', 2, 40, FALSE),
('Morfina 10mg', 'Analgésico opioide para el tratamiento del dolor severo', 'medicamento', 'Morfina', '10mg', 'Ampollas', 'Intravenosa', 2, 15, FALSE),

-- Antisépticos
('Alcohol Isopropílico 70%', 'Antiséptico para la desinfección de la piel', 'insumo', NULL, '70%', 'Botella 500ml', 'Tópico', 3, 20, FALSE),
('Clorhexidina 0.5%', 'Antiséptico para la desinfección de heridas', 'insumo', 'Clorhexidina', '0.5%', 'Solución 500ml', 'Tópico', 3, 15, FALSE),
('Yodo Povidona', 'Antiséptico yodado para desinfección', 'insumo', 'Povidona yodada', '10%', 'Solución 500ml', 'Tópico', 3, 18, FALSE),

-- Material de Curación
('Gasas Estériles 10x10cm', 'Gasas estériles para curaciones y apósitos', 'insumo', NULL, NULL, 'Paquete x10', 'Tópico', 4, 50, FALSE),
('Vendas Elásticas 10cm', 'Vendas elásticas para inmovilización y soporte', 'insumo', NULL, '10cm', 'Unidad', 'Tópico', 4, 30, FALSE),
('Apósitos Adhesivos', 'Apósitos estériles para heridas menores', 'insumo', NULL, NULL, 'Caja x50', 'Tópico', 4, 40, FALSE),
('Algodón Estéril', 'Algodón estéril para curaciones', 'insumo', NULL, NULL, 'Paquete 500g', 'Tópico', 4, 25, FALSE),

-- Medicamentos Cardiovasculares
('Atenolol 50mg', 'Betabloqueante para el tratamiento de la hipertensión y las arritmias', 'medicamento', 'Atenolol', '50mg', 'Tabletas', 'Oral', 6, 35, FALSE),
('Losartán 50mg', 'Antagonista de angiotensina para el tratamiento de la hipertensión', 'medicamento', 'Losartán', '50mg', 'Tabletas', 'Oral', 6, 30, FALSE),

-- Medicamentos Respiratorios
('Salbutamol Inhalador', 'Broncodilatador para el tratamiento del asma y la EPOC', 'medicamento', 'Salbutamol', '100mcg', 'Inhalador', 'Inhalación', 7, 25, FALSE),
('Budesonida Nebulización', 'Corticosteroide inhalado para el tratamiento del asma', 'medicamento', 'Budesonida', '0.5mg', 'Nebulización', 'Inhalación', 7, 20, FALSE),

-- Suplementos
('Vitamina D3 1000UI', 'Suplemento de vitamina D para el tratamiento de deficiencias', 'medicamento', 'Colecalciferol', '1000UI', 'Cápsulas', 'Oral', 8, 40, FALSE),
('Ácido Fólico 5mg', 'Suplemento para el tratamiento de la anemia y durante el embarazo', 'medicamento', 'Ácido Fólico', '5mg', 'Tabletas', 'Oral', 8, 30, FALSE);

-- ============================================================================
-- INSERTAR LOTES DE PRODUCTOS
-- ============================================================================

-- Lotes de Amoxicilina
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid) VALUES
(9, 'AMX-2024-001', DATE_ADD(CURDATE(), INTERVAL 8 MONTH), 50, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'A1B2C3D4'),
(9, 'AMX-2024-002', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 75, CURDATE(), 'E5F6G7H8'),

-- Lotes de Paracetamol
(12, 'PAR-2024-001', DATE_ADD(CURDATE(), INTERVAL 18 MONTH), 100, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'I9J0K1L2'),
(12, 'PAR-2024-002', DATE_ADD(CURDATE(), INTERVAL 20 MONTH), 120, DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 'M3N4O5P6'),

-- Lotes de Gasas (algunos por vencer)
(15, 'GAS-2024-001', DATE_ADD(CURDATE(), INTERVAL 3 MONTH), 30, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), 'Q7R8S9T0'),
(15, 'GAS-2024-002', DATE_ADD(CURDATE(), INTERVAL 15 DAY), 25, DATE_SUB(CURDATE(), INTERVAL 6 MONTH), 'U1V2W3X4'),
(15, 'GAS-2024-003', DATE_ADD(CURDATE(), INTERVAL 6 MONTH), 40, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), NULL),

-- Lotes de Alcohol
(17, 'ALC-2024-001', DATE_ADD(CURDATE(), INTERVAL 24 MONTH), 15, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Y5Z6A7B8'),
(17, 'ALC-2024-002', DATE_ADD(CURDATE(), INTERVAL 30 MONTH), 20, CURDATE(), NULL),

-- Lotes de Ibuprofeno
(13, 'IBU-2024-001', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 60, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'C9D0E1F2'),
(13, 'IBU-2024-002', DATE_ADD(CURDATE(), INTERVAL 15 MONTH), 80, DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 'G3H4I5J6'),

-- Lotes de Atenolol
(19, 'ATE-2024-001', DATE_ADD(CURDATE(), INTERVAL 10 MONTH), 45, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'K7L8M9N0'),
(19, 'ATE-2024-002', DATE_ADD(CURDATE(), INTERVAL 14 MONTH), 50, CURDATE(), 'O1P2Q3R4'),

-- Lotes de Salbutamol
(21, 'SAL-2024-001', DATE_ADD(CURDATE(), INTERVAL 9 MONTH), 30, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'S5T6U7V8'),
(21, 'SAL-2024-002', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 35, DATE_SUB(CURDATE(), INTERVAL 1 WEEK), NULL),

-- Lotes de Vendas
(16, 'VEN-2024-001', DATE_ADD(CURDATE(), INTERVAL 36 MONTH), 25, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'W9X0Y1Z2'),
(16, 'VEN-2024-002', DATE_ADD(CURDATE(), INTERVAL 40 MONTH), 30, CURDATE(), 'A3B4C5D6'),

-- Lotes de Vitamina D3
(23, 'VITD-2024-001', DATE_ADD(CURDATE(), INTERVAL 18 MONTH), 60, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'E7F8G9H0'),
(23, 'VITD-2024-002', DATE_ADD(CURDATE(), INTERVAL 24 MONTH), 70, CURDATE(), 'I1J2K3L4');

-- ============================================================================
-- INSERTAR HISTORIAL DE STOCK (MOVIMIENTOS)
-- ============================================================================

-- Obtener IDs de productos y áreas para el historial
SET @amox_id = (SELECT id FROM products WHERE name = 'Amoxicilina 500mg' LIMIT 1);
SET @parac_id = (SELECT id FROM products WHERE name = 'Paracetamol 500mg' LIMIT 1);
SET @gasas_id = (SELECT id FROM products WHERE name = 'Gasas Estériles 10x10cm' LIMIT 1);
SET @ibu_id = (SELECT id FROM products WHERE name = 'Ibuprofeno 400mg' LIMIT 1);
SET @urgencias_id = (SELECT id FROM areas WHERE name = 'Urgencias' LIMIT 1);
SET @cirugia_id = (SELECT id FROM areas WHERE name = 'Cirugía' LIMIT 1);
SET @pediatria_id = (SELECT id FROM areas WHERE name = 'Pediatría' LIMIT 1);
SET @enfermeria_id = (SELECT id FROM areas WHERE name = 'Enfermería' LIMIT 1);

-- Obtener IDs de lotes
SET @amox_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'AMX-2024-001' LIMIT 1);
SET @parac_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'PAR-2024-001' LIMIT 1);
SET @gasas_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'GAS-2024-001' LIMIT 1);
SET @gasas_lot2 = (SELECT id FROM product_batches WHERE lot_number = 'GAS-2024-002' LIMIT 1);
SET @ibu_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'IBU-2024-001' LIMIT 1);

-- Insertar historial de retiros (últimos 30 días)
INSERT IGNORE INTO stock_history (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes) VALUES
-- Retiros de Urgencias
(@amox_id, @amox_lot1, @urgencias_id, 50, 45, 'remove', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Retiro para paciente con infección bacteriana'),
(@amox_id, @amox_lot1, @urgencias_id, 45, 40, 'remove', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Retiro para paciente con neumonía'),
(@parac_id, @parac_lot1, @urgencias_id, 100, 95, 'remove', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Retiro para paciente con fiebre'),
(@parac_id, @parac_lot1, @urgencias_id, 95, 90, 'remove', DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Retiro para paciente pediátrico'),
(@gasas_id, @gasas_lot1, @urgencias_id, 30, 28, 'remove', DATE_SUB(CURDATE(), INTERVAL 6 DAY), 'Retiro para curación de herida'),

-- Retiros de Cirugía
(@gasas_id, @gasas_lot1, @cirugia_id, 28, 25, 'remove', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Retiro para procedimiento quirúrgico'),
(@gasas_id, @gasas_lot2, @cirugia_id, 25, 22, 'remove', DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'Retiro para cirugía mayor'),
(@ibu_id, @ibu_lot1, @cirugia_id, 60, 58, 'remove', DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'Retiro para tratamiento postoperatorio'),

-- Retiros de Pediatría
(@parac_id, @parac_lot1, @pediatria_id, 90, 88, 'remove', DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Retiro para paciente pediátrico'),
(@amox_id, @amox_lot1, @pediatria_id, 40, 38, 'remove', DATE_SUB(CURDATE(), INTERVAL 18 DAY), 'Retiro para tratamiento de infección pediátrica'),

-- Retiros de Enfermería
(@gasas_id, @gasas_lot1, @enfermeria_id, 22, 20, 'remove', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'Retiro para cambio de apósito'),
(@parac_id, @parac_lot1, @enfermeria_id, 88, 85, 'remove', DATE_SUB(CURDATE(), INTERVAL 22 DAY), 'Retiro para paciente en sala de hospitalización'),

-- Ingresos de stock
(@amox_id, @amox_lot1, NULL, 40, 50, 'add', DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Ingreso de nuevo lote'),
(@parac_id, @parac_lot1, NULL, 85, 100, 'add', DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Reabastecimiento de inventario');

-- ============================================================================
-- INSERTAR PREDICCIONES DE CONSUMO
-- ============================================================================

-- Predicciones para el próximo mes
INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date) VALUES
-- Predicciones generales (sin área específica)
(@amox_id, NULL, 'month', 45, 85.5, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@parac_id, NULL, 'month', 120, 90.2, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@gasas_id, NULL, 'month', 35, 78.3, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@ibu_id, NULL, 'month', 70, 82.1, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),

-- Predicciones por área específica
(@amox_id, @urgencias_id, 'month', 15, 75.0, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@parac_id, @urgencias_id, 'month', 25, 80.5, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@gasas_id, @cirugia_id, 'month', 12, 70.2, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),

-- Predicciones para el próximo trimestre
(@amox_id, NULL, 'quarter', 135, 75.8, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 3 MONTH)),
(@parac_id, NULL, 'quarter', 360, 82.3, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 3 MONTH)),

-- Predicciones para el próximo año
(@amox_id, NULL, 'year', 540, 68.5, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 12 MONTH)),
(@parac_id, NULL, 'year', 1440, 72.1, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 12 MONTH));

-- ============================================================================
-- VERIFICAR DATOS INSERTADOS
-- ============================================================================

SELECT 'Productos insertados:' as Info, COUNT(*) as Cantidad FROM products;
SELECT 'Lotes insertados:' as Info, COUNT(*) as Cantidad FROM product_batches;
SELECT 'Movimientos de stock:' as Info, COUNT(*) as Cantidad FROM stock_history;
SELECT 'Predicciones insertadas:' as Info, COUNT(*) as Cantidad FROM consumption_predictions;

-- Mostrar resumen de productos con stock
SELECT 
    p.name as Producto,
    p.product_type as Tipo,
    COALESCE(SUM(pb.quantity), 0) as Stock_Total,
    p.min_stock as Stock_Minimo,
    COUNT(pb.id) as Num_Lotes
FROM products p
LEFT JOIN product_batches pb ON pb.product_id = p.id
GROUP BY p.id, p.name, p.product_type, p.min_stock
ORDER BY p.name;

