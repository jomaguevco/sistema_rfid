-- Script para insertar más datos de ejemplo en el sistema médico
-- Ejecutar después de insert_sample_data.sql

USE rfid_stock_db;

-- ============================================================================
-- INSERTAR MÁS PRODUCTOS MÉDICOS
-- ============================================================================

INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration) VALUES
-- Más Antibióticos
('Ciprofloxacino 500mg', 'Antibiótico fluoroquinolona para infecciones del tracto urinario', 'medicamento', 'Ciprofloxacino', '500mg', 'Tabletas', 'Oral', 1, 25, FALSE),
('Doxiciclina 100mg', 'Antibiótico tetraciclina para infecciones respiratorias y de la piel', 'medicamento', 'Doxiciclina', '100mg', 'Cápsulas', 'Oral', 1, 20, FALSE),
('Metronidazol 500mg', 'Antibiótico para infecciones anaerobias y parasitarias', 'medicamento', 'Metronidazol', '500mg', 'Tabletas', 'Oral', 1, 15, FALSE),

-- Más Analgésicos
('Tramadol 50mg', 'Analgésico opioide sintético para dolor moderado a severo', 'medicamento', 'Tramadol', '50mg', 'Cápsulas', 'Oral', 2, 30, FALSE),
('Ketorolaco 30mg', 'Antiinflamatorio no esteroideo inyectable para dolor agudo', 'medicamento', 'Ketorolaco', '30mg', 'Ampollas', 'Intramuscular', 2, 20, FALSE),
('Diclofenaco 50mg', 'Antiinflamatorio no esteroideo para dolor e inflamación', 'medicamento', 'Diclofenaco', '50mg', 'Tabletas', 'Oral', 2, 35, FALSE),

-- Más Antisépticos
('Agua Oxigenada 3%', 'Antiséptico oxidante para limpieza de heridas', 'insumo', 'Peróxido de hidrógeno', '3%', 'Botella 500ml', 'Tópico', 3, 25, FALSE),
('Solución Salina 0.9%', 'Solución isotónica para limpieza y lavado', 'insumo', 'Cloruro de sodio', '0.9%', 'Bolsa 500ml', 'Tópico/Intravenosa', 3, 30, FALSE),

-- Más Material de Curación
('Esparadrapo 5cm', 'Cinta adhesiva médica para fijación de apósitos', 'insumo', NULL, '5cm', 'Rollo', 'Tópico', 4, 40, FALSE),
('Tijeras Quirúrgicas', 'Tijeras estériles para procedimientos médicos', 'insumo', NULL, NULL, 'Unidad', 'Tópico', 4, 15, FALSE),
('Pinzas de Disección', 'Pinzas estériles para manipulación de tejidos', 'insumo', NULL, NULL, 'Unidad', 'Tópico', 4, 20, FALSE),
('Suturas Absorbibles 3-0', 'Hilo de sutura absorbible para cierre de heridas', 'insumo', NULL, '3-0', 'Paquete x12', 'Tópico', 4, 25, FALSE),

-- Más Medicamentos Cardiovasculares
('Enalapril 10mg', 'Inhibidor de la enzima convertidora para hipertensión', 'medicamento', 'Enalapril', '10mg', 'Tabletas', 'Oral', 6, 30, FALSE),
('Amlodipino 5mg', 'Bloqueador de canales de calcio para hipertensión', 'medicamento', 'Amlodipino', '5mg', 'Tabletas', 'Oral', 6, 35, FALSE),
('Digoxina 0.25mg', 'Glucósido cardíaco para insuficiencia cardíaca', 'medicamento', 'Digoxina', '0.25mg', 'Tabletas', 'Oral', 6, 20, FALSE),

-- Más Medicamentos Respiratorios
('Ipratropio Nebulización', 'Broncodilatador anticolinérgico para EPOC', 'medicamento', 'Ipratropio', '0.5mg', 'Nebulización', 'Inhalación', 7, 18, FALSE),
('Prednisona 20mg', 'Corticosteroide oral para asma y enfermedades respiratorias', 'medicamento', 'Prednisona', '20mg', 'Tabletas', 'Oral', 7, 25, FALSE),

-- Más Suplementos
('Hierro Sulfato 200mg', 'Suplemento de hierro para tratamiento de anemia', 'medicamento', 'Sulfato ferroso', '200mg', 'Tabletas', 'Oral', 8, 30, FALSE),
('Calcio Carbonato 500mg', 'Suplemento de calcio para salud ósea', 'medicamento', 'Carbonato de calcio', '500mg', 'Tabletas', 'Oral', 8, 40, FALSE),
('Multivitamínico', 'Complejo vitamínico para suplementación nutricional', 'medicamento', NULL, NULL, 'Tabletas', 'Oral', 8, 35, FALSE);

-- ============================================================================
-- INSERTAR MÁS LOTES DE PRODUCTOS
-- ============================================================================

-- Obtener IDs de productos recién insertados
SET @cipro_id = (SELECT id FROM products WHERE name = 'Ciprofloxacino 500mg' LIMIT 1);
SET @doxi_id = (SELECT id FROM products WHERE name = 'Doxiciclina 100mg' LIMIT 1);
SET @tramadol_id = (SELECT id FROM products WHERE name = 'Tramadol 50mg' LIMIT 1);
SET @ketorolaco_id = (SELECT id FROM products WHERE name = 'Ketorolaco 30mg' LIMIT 1);
SET @diclofenaco_id = (SELECT id FROM products WHERE name = 'Diclofenaco 50mg' LIMIT 1);
SET @agua_ox_id = (SELECT id FROM products WHERE name = 'Agua Oxigenada 3%' LIMIT 1);
SET @saline_id = (SELECT id FROM products WHERE name = 'Solución Salina 0.9%' LIMIT 1);
SET @esparadrapo_id = (SELECT id FROM products WHERE name = 'Esparadrapo 5cm' LIMIT 1);
SET @enapril_id = (SELECT id FROM products WHERE name = 'Enalapril 10mg' LIMIT 1);
SET @amlodipino_id = (SELECT id FROM products WHERE name = 'Amlodipino 5mg' LIMIT 1);
SET @ipratropio_id = (SELECT id FROM products WHERE name = 'Ipratropio Nebulización' LIMIT 1);
SET @hierro_id = (SELECT id FROM products WHERE name = 'Hierro Sulfato 200mg' LIMIT 1);

-- Insertar lotes para los nuevos productos
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid) VALUES
-- Ciprofloxacino
(@cipro_id, 'CIP-2024-001', DATE_ADD(CURDATE(), INTERVAL 10 MONTH), 40, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'C1D2E3F4'),
(@cipro_id, 'CIP-2024-002', DATE_ADD(CURDATE(), INTERVAL 14 MONTH), 50, CURDATE(), 'G5H6I7J8'),

-- Doxiciclina
(@doxi_id, 'DOX-2024-001', DATE_ADD(CURDATE(), INTERVAL 9 MONTH), 35, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'K9L0M1N2'),
(@doxi_id, 'DOX-2024-002', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 45, DATE_SUB(CURDATE(), INTERVAL 1 WEEK), NULL),

-- Tramadol
(@tramadol_id, 'TRA-2024-001', DATE_ADD(CURDATE(), INTERVAL 11 MONTH), 60, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'O3P4Q5R6'),
(@tramadol_id, 'TRA-2024-002', DATE_ADD(CURDATE(), INTERVAL 15 MONTH), 70, CURDATE(), 'S7T8U9V0'),

-- Ketorolaco
(@ketorolaco_id, 'KET-2024-001', DATE_ADD(CURDATE(), INTERVAL 8 MONTH), 25, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'W1X2Y3Z4'),
(@ketorolaco_id, 'KET-2024-002', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 30, CURDATE(), 'A5B6C7D8'),

-- Diclofenaco
(@diclofenaco_id, 'DIC-2024-001', DATE_ADD(CURDATE(), INTERVAL 13 MONTH), 80, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'E9F0G1H2'),
(@diclofenaco_id, 'DIC-2024-002', DATE_ADD(CURDATE(), INTERVAL 16 MONTH), 90, DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 'I3J4K5L6'),

-- Agua Oxigenada
(@agua_ox_id, 'AO-2024-001', DATE_ADD(CURDATE(), INTERVAL 24 MONTH), 20, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'M7N8O9P0'),
(@agua_ox_id, 'AO-2024-002', DATE_ADD(CURDATE(), INTERVAL 30 MONTH), 25, CURDATE(), NULL),

-- Solución Salina
(@saline_id, 'SS-2024-001', DATE_ADD(CURDATE(), INTERVAL 36 MONTH), 50, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Q1R2S3T4'),
(@saline_id, 'SS-2024-002', DATE_ADD(CURDATE(), INTERVAL 40 MONTH), 60, CURDATE(), 'U5V6W7X8'),

-- Esparadrapo
(@esparadrapo_id, 'ESP-2024-001', DATE_ADD(CURDATE(), INTERVAL 48 MONTH), 30, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Y9Z0A1B2'),
(@esparadrapo_id, 'ESP-2024-002', DATE_ADD(CURDATE(), INTERVAL 50 MONTH), 35, CURDATE(), NULL),

-- Enalapril
(@enapril_id, 'ENA-2024-001', DATE_ADD(CURDATE(), INTERVAL 11 MONTH), 55, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'C3D4E5F6'),
(@enapril_id, 'ENA-2024-002', DATE_ADD(CURDATE(), INTERVAL 15 MONTH), 65, CURDATE(), 'G7H8I9J0'),

-- Amlodipino
(@amlodipino_id, 'AML-2024-001', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 70, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'K1L2M3N4'),
(@amlodipino_id, 'AML-2024-002', DATE_ADD(CURDATE(), INTERVAL 16 MONTH), 80, DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 'O5P6Q7R8'),

-- Ipratropio
(@ipratropio_id, 'IPR-2024-001', DATE_ADD(CURDATE(), INTERVAL 10 MONTH), 28, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'S9T0U1V2'),
(@ipratropio_id, 'IPR-2024-002', DATE_ADD(CURDATE(), INTERVAL 13 MONTH), 32, CURDATE(), NULL),

-- Hierro
(@hierro_id, 'HIE-2024-001', DATE_ADD(CURDATE(), INTERVAL 20 MONTH), 50, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'W3X4Y5Z6'),
(@hierro_id, 'HIE-2024-002', DATE_ADD(CURDATE(), INTERVAL 24 MONTH), 60, CURDATE(), 'A7B8C9D0');

-- ============================================================================
-- INSERTAR MÁS HISTORIAL DE STOCK
-- ============================================================================

-- Obtener IDs de áreas
SET @urgencias_id = (SELECT id FROM areas WHERE name = 'Urgencias' LIMIT 1);
SET @cirugia_id = (SELECT id FROM areas WHERE name = 'Cirugía' LIMIT 1);
SET @pediatria_id = (SELECT id FROM areas WHERE name = 'Pediatría' LIMIT 1);
SET @enfermeria_id = (SELECT id FROM areas WHERE name = 'Enfermería' LIMIT 1);
SET @maternidad_id = (SELECT id FROM areas WHERE name = 'Maternidad' LIMIT 1);
SET @farmacia_id = (SELECT id FROM areas WHERE name = 'Farmacia' LIMIT 1);

-- Obtener IDs de lotes nuevos
SET @cipro_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'CIP-2024-001' LIMIT 1);
SET @tramadol_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'TRA-2024-001' LIMIT 1);
SET @ketorolaco_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'KET-2024-001' LIMIT 1);
SET @diclofenaco_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'DIC-2024-001' LIMIT 1);
SET @saline_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'SS-2024-001' LIMIT 1);
SET @enapril_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'ENA-2024-001' LIMIT 1);
SET @amlodipino_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'AML-2024-001' LIMIT 1);
SET @hierro_lot1 = (SELECT id FROM product_batches WHERE lot_number = 'HIE-2024-001' LIMIT 1);

-- Insertar más historial de retiros
INSERT IGNORE INTO stock_history (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes) VALUES
-- Retiros de Urgencias (más recientes)
(@cipro_id, @cipro_lot1, @urgencias_id, 40, 38, 'remove', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Retiro para paciente con infección urinaria'),
(@tramadol_id, @tramadol_lot1, @urgencias_id, 60, 58, 'remove', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Retiro para paciente con dolor postraumático'),
(@ketorolaco_id, @ketorolaco_lot1, @urgencias_id, 25, 23, 'remove', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Retiro para paciente con dolor agudo'),

-- Retiros de Cirugía
(@diclofenaco_id, @diclofenaco_lot1, @cirugia_id, 80, 77, 'remove', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Retiro para tratamiento postoperatorio'),
(@saline_id, @saline_lot1, @cirugia_id, 50, 48, 'remove', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Retiro para lavado quirúrgico'),
(@ketorolaco_id, @ketorolaco_lot1, @cirugia_id, 23, 21, 'remove', DATE_SUB(CURDATE(), INTERVAL 9 DAY), 'Retiro para manejo del dolor postoperatorio'),

-- Retiros de Pediatría
(@enapril_id, @enapril_lot1, @pediatria_id, 55, 53, 'remove', DATE_SUB(CURDATE(), INTERVAL 11 DAY), 'Retiro para paciente pediátrico con hipertensión'),
(@hierro_id, @hierro_lot1, @pediatria_id, 50, 48, 'remove', DATE_SUB(CURDATE(), INTERVAL 13 DAY), 'Retiro para tratamiento de anemia pediátrica'),

-- Retiros de Maternidad
(@amlodipino_id, @amlodipino_lot1, @maternidad_id, 70, 68, 'remove', DATE_SUB(CURDATE(), INTERVAL 14 DAY), 'Retiro para paciente gestante con hipertensión'),
(@hierro_id, @hierro_lot1, @maternidad_id, 48, 46, 'remove', DATE_SUB(CURDATE(), INTERVAL 16 DAY), 'Retiro para prevención de anemia en gestante'),

-- Retiros de Enfermería
(@saline_id, @saline_lot1, @enfermeria_id, 48, 46, 'remove', DATE_SUB(CURDATE(), INTERVAL 17 DAY), 'Retiro para limpieza de heridas'),
(@tramadol_id, @tramadol_lot1, @enfermeria_id, 58, 56, 'remove', DATE_SUB(CURDATE(), INTERVAL 19 DAY), 'Retiro para paciente en sala'),

-- Ingresos de stock
(@cipro_id, @cipro_lot1, NULL, 35, 40, 'add', DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Ingreso de nuevo lote'),
(@tramadol_id, @tramadol_lot1, NULL, 50, 60, 'add', DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Reabastecimiento de inventario'),
(@diclofenaco_id, @diclofenaco_lot1, NULL, 70, 80, 'add', DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Ingreso de nuevo lote'),
(@saline_id, @saline_lot1, NULL, 40, 50, 'add', DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Reabastecimiento de inventario');

-- ============================================================================
-- INSERTAR MÁS PREDICCIONES DE CONSUMO
-- ============================================================================

-- Predicciones para el próximo mes (nuevos productos)
INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date) VALUES
-- Predicciones generales
(@cipro_id, NULL, 'month', 35, 82.5, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@tramadol_id, NULL, 'month', 55, 88.2, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@diclofenaco_id, NULL, 'month', 75, 85.7, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@ketorolaco_id, NULL, 'month', 22, 79.3, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@saline_id, NULL, 'month', 45, 91.0, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@enapril_id, NULL, 'month', 50, 83.8, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@amlodipino_id, NULL, 'month', 65, 87.1, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@hierro_id, NULL, 'month', 48, 81.4, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),

-- Predicciones por área específica
(@cipro_id, @urgencias_id, 'month', 12, 75.5, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@tramadol_id, @urgencias_id, 'month', 18, 80.2, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@ketorolaco_id, @cirugia_id, 'month', 8, 72.8, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@saline_id, @cirugia_id, 'month', 15, 88.5, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),
(@hierro_id, @maternidad_id, 'month', 10, 78.9, 'moving_average', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 1 MONTH)),

-- Predicciones para el próximo trimestre
(@cipro_id, NULL, 'quarter', 105, 76.2, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 3 MONTH)),
(@tramadol_id, NULL, 'quarter', 165, 81.5, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 3 MONTH)),
(@diclofenaco_id, NULL, 'quarter', 225, 79.8, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 3 MONTH)),

-- Predicciones para el próximo año
(@cipro_id, NULL, 'year', 420, 71.3, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 12 MONTH)),
(@tramadol_id, NULL, 'year', 660, 75.6, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 12 MONTH)),
(@diclofenaco_id, NULL, 'year', 900, 73.9, 'linear_regression', DATE_ADD(CURDATE(), INTERVAL 1 DAY), DATE_ADD(CURDATE(), INTERVAL 12 MONTH));

-- ============================================================================
-- VERIFICAR DATOS INSERTADOS
-- ============================================================================

SELECT 'Productos adicionales insertados:' as Info, COUNT(*) as Cantidad FROM products WHERE id > 23;
SELECT 'Lotes adicionales insertados:' as Info, COUNT(*) as Cantidad FROM product_batches WHERE id > 24;
SELECT 'Movimientos adicionales de stock:' as Info, COUNT(*) as Cantidad FROM stock_history WHERE id > 14;
SELECT 'Predicciones adicionales insertadas:' as Info, COUNT(*) as Cantidad FROM consumption_predictions WHERE id > 12;

-- Mostrar resumen total
SELECT 
    'Total productos:' as Resumen,
    COUNT(*) as Cantidad 
FROM products
UNION ALL
SELECT 
    'Total lotes:' as Resumen,
    COUNT(*) as Cantidad 
FROM product_batches
UNION ALL
SELECT 
    'Total movimientos:' as Resumen,
    COUNT(*) as Cantidad 
FROM stock_history
UNION ALL
SELECT 
    'Total predicciones:' as Resumen,
    COUNT(*) as Cantidad 
FROM consumption_predictions;

