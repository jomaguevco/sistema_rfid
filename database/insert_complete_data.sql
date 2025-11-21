-- Script completo para poblar TODAS las tablas del sistema médico
-- Este script asegura que todas las funcionalidades sean visibles y utilizables

USE rfid_stock_db;

-- ============================================================================
-- VERIFICAR Y COMPLETAR DATOS EN TODAS LAS TABLAS
-- ============================================================================

-- Obtener IDs de productos existentes
SET @amox_id = (SELECT id FROM products WHERE name LIKE 'Amoxicilina%' LIMIT 1);
SET @parac_id = (SELECT id FROM products WHERE name LIKE 'Paracetamol%' LIMIT 1);
SET @gasas_id = (SELECT id FROM products WHERE name LIKE 'Gasas Estériles%' LIMIT 1);
SET @ibu_id = (SELECT id FROM products WHERE name LIKE 'Ibuprofeno%' LIMIT 1);
SET @morfina_id = (SELECT id FROM products WHERE name LIKE 'Morfina%' LIMIT 1);
SET @alcohol_id = (SELECT id FROM products WHERE name LIKE 'Alcohol Isopropílico%' LIMIT 1);
SET @clorhex_id = (SELECT id FROM products WHERE name LIKE 'Clorhexidina%' LIMIT 1);
SET @vendas_id = (SELECT id FROM products WHERE name LIKE 'Vendas Elásticas%' LIMIT 1);
SET @apositos_id = (SELECT id FROM products WHERE name LIKE 'Apósitos Adhesivos%' LIMIT 1);
SET @algodon_id = (SELECT id FROM products WHERE name LIKE 'Algodón Estéril%' LIMIT 1);
SET @atenolol_id = (SELECT id FROM products WHERE name LIKE 'Atenolol%' LIMIT 1);
SET @losartan_id = (SELECT id FROM products WHERE name LIKE 'Losartán%' LIMIT 1);
SET @salbutamol_id = (SELECT id FROM products WHERE name LIKE 'Salbutamol%' LIMIT 1);
SET @budesonida_id = (SELECT id FROM products WHERE name LIKE 'Budesonida%' LIMIT 1);
SET @vitd_id = (SELECT id FROM products WHERE name LIKE 'Vitamina D3%' LIMIT 1);
SET @acido_folico_id = (SELECT id FROM products WHERE name LIKE 'Ácido Fólico%' LIMIT 1);

-- Obtener IDs de áreas
SET @urgencias_id = (SELECT id FROM areas WHERE name = 'Urgencias' LIMIT 1);
SET @cirugia_id = (SELECT id FROM areas WHERE name = 'Cirugía' LIMIT 1);
SET @pediatria_id = (SELECT id FROM areas WHERE name = 'Pediatría' LIMIT 1);
SET @maternidad_id = (SELECT id FROM areas WHERE name = 'Maternidad' LIMIT 1);
SET @enfermeria_id = (SELECT id FROM areas WHERE name = 'Enfermería' LIMIT 1);
SET @farmacia_id = (SELECT id FROM areas WHERE name = 'Farmacia' LIMIT 1);
SET @lab_id = (SELECT id FROM areas WHERE name = 'Laboratorio' LIMIT 1);
SET @radio_id = (SELECT id FROM areas WHERE name = 'Radiología' LIMIT 1);

-- ============================================================================
-- INSERTAR LOTES CON DIFERENTES ESTADOS DE VENCIMIENTO
-- ============================================================================

-- Lotes VENCIDOS (para alertas críticas)
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid) VALUES
(@gasas_id, 'GAS-VENC-001', DATE_SUB(CURDATE(), INTERVAL 15 DAY), 10, DATE_SUB(CURDATE(), INTERVAL 6 MONTH), 'VEN001'),
(@alcohol_id, 'ALC-VENC-001', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 5, DATE_SUB(CURDATE(), INTERVAL 8 MONTH), 'VEN002'),
(@clorhex_id, 'CLO-VENC-001', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 8, DATE_SUB(CURDATE(), INTERVAL 7 MONTH), 'VEN003');

-- Lotes por VENCER PRONTO (15-30 días - alertas altas)
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid) VALUES
(@gasas_id, 'GAS-PRVENC-001', DATE_ADD(CURDATE(), INTERVAL 20 DAY), 15, DATE_SUB(CURDATE(), INTERVAL 5 MONTH), 'PRV001'),
(@vendas_id, 'VEN-PRVENC-001', DATE_ADD(CURDATE(), INTERVAL 18 DAY), 12, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), 'PRV002'),
(@apositos_id, 'APO-PRVENC-001', DATE_ADD(CURDATE(), INTERVAL 25 DAY), 20, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), 'PRV003'),
(@algodon_id, 'ALG-PRVENC-001', DATE_ADD(CURDATE(), INTERVAL 22 DAY), 18, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), 'PRV004');

-- Lotes por vencer en 30-60 días (alertas medias)
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid) VALUES
(@amox_id, 'AMX-PRVENC-002', DATE_ADD(CURDATE(), INTERVAL 45 DAY), 25, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'PRV005'),
(@parac_id, 'PAR-PRVENC-002', DATE_ADD(CURDATE(), INTERVAL 50 DAY), 30, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), 'PRV006'),
(@ibu_id, 'IBU-PRVENC-002', DATE_ADD(CURDATE(), INTERVAL 55 DAY), 28, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'PRV007');

-- Lotes con STOCK BAJO (menos del mínimo)
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid) VALUES
(@morfina_id, 'MOR-BAJO-001', DATE_ADD(CURDATE(), INTERVAL 8 MONTH), 5, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'BAJ001'),
(@budesonida_id, 'BUD-BAJO-001', DATE_ADD(CURDATE(), INTERVAL 9 MONTH), 8, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'BAJ002'),
(@acido_folico_id, 'ACF-BAJO-001', DATE_ADD(CURDATE(), INTERVAL 10 MONTH), 10, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'BAJ003');

-- Lotes SIN RFID asignado (para alertas)
INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid) VALUES
(@atenolol_id, 'ATE-NORFID-001', DATE_ADD(CURDATE(), INTERVAL 11 MONTH), 40, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), NULL),
(@losartan_id, 'LOS-NORFID-001', DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 35, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), NULL),
(@salbutamol_id, 'SAL-NORFID-001', DATE_ADD(CURDATE(), INTERVAL 10 MONTH), 30, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), NULL);

-- ============================================================================
-- INSERTAR MÁS HISTORIAL DE STOCK (últimos 90 días)
-- ============================================================================

-- Obtener IDs de lotes existentes
SET @gasas_lot_venc = (SELECT id FROM product_batches WHERE lot_number = 'GAS-VENC-001' LIMIT 1);
SET @gasas_lot_prvenc = (SELECT id FROM product_batches WHERE lot_number = 'GAS-PRVENC-001' LIMIT 1);
SET @amox_lot_prvenc = (SELECT id FROM product_batches WHERE lot_number = 'AMX-PRVENC-002' LIMIT 1);
SET @parac_lot_prvenc = (SELECT id FROM product_batches WHERE lot_number = 'PAR-PRVENC-002' LIMIT 1);
SET @morfina_lot_bajo = (SELECT id FROM product_batches WHERE lot_number = 'MOR-BAJO-001' LIMIT 1);

-- Historial de consumo diario (últimos 60 días) para diferentes áreas
INSERT IGNORE INTO stock_history (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes) VALUES
-- Urgencias - consumo diario variado
(@parac_id, @parac_lot_prvenc, @urgencias_id, 100, 98, 'remove', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Retiro para paciente con fiebre'),
(@parac_id, @parac_lot_prvenc, @urgencias_id, 98, 96, 'remove', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Retiro para paciente pediátrico'),
(@amox_id, @amox_lot_prvenc, @urgencias_id, 50, 48, 'remove', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Retiro para paciente con infección'),
(@amox_id, @amox_lot_prvenc, @urgencias_id, 48, 46, 'remove', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Retiro para paciente con neumonía'),
(@gasas_id, @gasas_lot_prvenc, @urgencias_id, 30, 28, 'remove', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Retiro para curación de herida'),
(@gasas_id, @gasas_lot_prvenc, @urgencias_id, 28, 26, 'remove', DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'Retiro para cambio de apósito'),

-- Cirugía - consumo semanal
(@gasas_id, @gasas_lot_prvenc, @cirugia_id, 26, 22, 'remove', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Retiro para procedimiento quirúrgico'),
(@gasas_id, @gasas_lot_prvenc, @cirugia_id, 22, 18, 'remove', DATE_SUB(CURDATE(), INTERVAL 14 DAY), 'Retiro para cirugía mayor'),
(@ibu_id, NULL, @cirugia_id, 60, 58, 'remove', DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'Retiro para tratamiento postoperatorio'),
(@morfina_id, @morfina_lot_bajo, @cirugia_id, 15, 13, 'remove', DATE_SUB(CURDATE(), INTERVAL 10 DAY), 'Retiro para manejo del dolor postoperatorio'),

-- Pediatría - consumo regular
(@parac_id, @parac_lot_prvenc, @pediatria_id, 96, 94, 'remove', DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'Retiro para paciente pediátrico'),
(@amox_id, @amox_lot_prvenc, @pediatria_id, 46, 44, 'remove', DATE_SUB(CURDATE(), INTERVAL 6 DAY), 'Retiro para infección pediátrica'),
(@vitd_id, NULL, @pediatria_id, 65, 63, 'remove', DATE_SUB(CURDATE(), INTERVAL 8 DAY), 'Retiro para suplementación pediátrica'),

-- Maternidad - consumo mensual
(@acido_folico_id, NULL, @maternidad_id, 30, 28, 'remove', DATE_SUB(CURDATE(), INTERVAL 12 DAY), 'Retiro para paciente gestante'),
(@hierro_id, NULL, @maternidad_id, 50, 48, 'remove', DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'Retiro para prevención de anemia'),
(@vitd_id, NULL, @maternidad_id, 63, 61, 'remove', DATE_SUB(CURDATE(), INTERVAL 18 DAY), 'Retiro para suplementación en gestación'),

-- Enfermería - consumo diario
(@gasas_id, @gasas_lot_prvenc, @enfermeria_id, 18, 16, 'remove', DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'Retiro para cambio de apósito'),
(@apositos_id, NULL, @enfermeria_id, 95, 93, 'remove', DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'Retiro para herida menor'),
(@algodon_id, NULL, @enfermeria_id, 55, 53, 'remove', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Retiro para curación'),

-- Historial histórico (últimos 60-90 días) para predicciones
(@parac_id, NULL, @urgencias_id, 100, 95, 'remove', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 95, 90, 'remove', DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 90, 85, 'remove', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 85, 80, 'remove', DATE_SUB(CURDATE(), INTERVAL 35 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 80, 75, 'remove', DATE_SUB(CURDATE(), INTERVAL 40 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 75, 70, 'remove', DATE_SUB(CURDATE(), INTERVAL 45 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 70, 65, 'remove', DATE_SUB(CURDATE(), INTERVAL 50 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 65, 60, 'remove', DATE_SUB(CURDATE(), INTERVAL 55 DAY), 'Retiro histórico'),
(@parac_id, NULL, @urgencias_id, 60, 55, 'remove', DATE_SUB(CURDATE(), INTERVAL 60 DAY), 'Retiro histórico'),

(@amox_id, NULL, @urgencias_id, 50, 48, 'remove', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'Retiro histórico'),
(@amox_id, NULL, @urgencias_id, 48, 46, 'remove', DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Retiro histórico'),
(@amox_id, NULL, @urgencias_id, 46, 44, 'remove', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Retiro histórico'),
(@amox_id, NULL, @urgencias_id, 44, 42, 'remove', DATE_SUB(CURDATE(), INTERVAL 35 DAY), 'Retiro histórico'),
(@amox_id, NULL, @urgencias_id, 42, 40, 'remove', DATE_SUB(CURDATE(), INTERVAL 40 DAY), 'Retiro histórico'),

(@gasas_id, NULL, @cirugia_id, 30, 28, 'remove', DATE_SUB(CURDATE(), INTERVAL 20 DAY), 'Retiro histórico'),
(@gasas_id, NULL, @cirugia_id, 28, 26, 'remove', DATE_SUB(CURDATE(), INTERVAL 25 DAY), 'Retiro histórico'),
(@gasas_id, NULL, @cirugia_id, 26, 24, 'remove', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'Retiro histórico'),
(@gasas_id, NULL, @cirugia_id, 24, 22, 'remove', DATE_SUB(CURDATE(), INTERVAL 35 DAY), 'Retiro histórico'),

-- Ingresos de stock
(@parac_id, NULL, NULL, 55, 100, 'add', DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Reabastecimiento de inventario'),
(@amox_id, NULL, NULL, 40, 50, 'add', DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Ingreso de nuevo lote'),
(@gasas_id, NULL, NULL, 22, 30, 'add', DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Reabastecimiento de inventario');

-- ============================================================================
-- GENERAR ALERTAS AUTOMÁTICAS
-- ============================================================================

-- Alertas de productos VENCIDOS (críticas)
INSERT IGNORE INTO stock_alerts (product_id, batch_id, alert_type, severity, message, is_resolved) VALUES
(@gasas_id, @gasas_lot_venc, 'expired', 'critical', CONCAT('Lote GAS-VENC-001 vencido hace ', DATEDIFF(CURDATE(), DATE_SUB(CURDATE(), INTERVAL 15 DAY)), ' días'), FALSE),
(@alcohol_id, (SELECT id FROM product_batches WHERE lot_number = 'ALC-VENC-001' LIMIT 1), 'expired', 'critical', CONCAT('Lote ALC-VENC-001 vencido hace ', DATEDIFF(CURDATE(), DATE_SUB(CURDATE(), INTERVAL 5 DAY)), ' días'), FALSE),
(@clorhex_id, (SELECT id FROM product_batches WHERE lot_number = 'CLO-VENC-001' LIMIT 1), 'expired', 'critical', CONCAT('Lote CLO-VENC-001 vencido hace ', DATEDIFF(CURDATE(), DATE_SUB(CURDATE(), INTERVAL 10 DAY)), ' días'), FALSE);

-- Alertas de productos por VENCER PRONTO (altas)
INSERT IGNORE INTO stock_alerts (product_id, batch_id, alert_type, severity, message, is_resolved) VALUES
(@gasas_id, @gasas_lot_prvenc, 'expiring_soon', 'high', 'Lote GAS-PRVENC-001 vence en 20 días', FALSE),
(@vendas_id, (SELECT id FROM product_batches WHERE lot_number = 'VEN-PRVENC-001' LIMIT 1), 'expiring_soon', 'high', 'Lote VEN-PRVENC-001 vence en 18 días', FALSE),
(@apositos_id, (SELECT id FROM product_batches WHERE lot_number = 'APO-PRVENC-001' LIMIT 1), 'expiring_soon', 'high', 'Lote APO-PRVENC-001 vence en 25 días', FALSE),
(@algodon_id, (SELECT id FROM product_batches WHERE lot_number = 'ALG-PRVENC-001' LIMIT 1), 'expiring_soon', 'high', 'Lote ALG-PRVENC-001 vence en 22 días', FALSE),
(@amox_id, @amox_lot_prvenc, 'expiring_soon', 'high', 'Lote AMX-PRVENC-002 vence en 45 días', FALSE),
(@parac_id, @parac_lot_prvenc, 'expiring_soon', 'high', 'Lote PAR-PRVENC-002 vence en 50 días', FALSE);

-- Alertas de STOCK BAJO (medias)
INSERT IGNORE INTO stock_alerts (product_id, batch_id, alert_type, severity, message, is_resolved) VALUES
(@morfina_id, @morfina_lot_bajo, 'low_stock', 'medium', 'Stock de Morfina 10mg por debajo del mínimo (5 unidades)', FALSE),
(@budesonida_id, (SELECT id FROM product_batches WHERE lot_number = 'BUD-BAJO-001' LIMIT 1), 'low_stock', 'medium', 'Stock de Budesonida Nebulización por debajo del mínimo (8 unidades)', FALSE),
(@acido_folico_id, (SELECT id FROM product_batches WHERE lot_number = 'ACF-BAJO-001' LIMIT 1), 'low_stock', 'medium', 'Stock de Ácido Fólico 5mg por debajo del mínimo (10 unidades)', FALSE),
(@clorhex_id, NULL, 'low_stock', 'medium', 'Stock de Clorhexidina 0.5% por debajo del mínimo', FALSE);

-- Alertas de LOTES SIN RFID (bajas)
INSERT IGNORE INTO stock_alerts (product_id, batch_id, alert_type, severity, message, is_resolved) VALUES
(@atenolol_id, (SELECT id FROM product_batches WHERE lot_number = 'ATE-NORFID-001' LIMIT 1), 'no_rfid', 'low', 'Lote ATE-NORFID-001 sin RFID asignado', FALSE),
(@losartan_id, (SELECT id FROM product_batches WHERE lot_number = 'LOS-NORFID-001' LIMIT 1), 'no_rfid', 'low', 'Lote LOS-NORFID-001 sin RFID asignado', FALSE),
(@salbutamol_id, (SELECT id FROM product_batches WHERE lot_number = 'SAL-NORFID-001' LIMIT 1), 'no_rfid', 'low', 'Lote SAL-NORFID-001 sin RFID asignado', FALSE);

-- ============================================================================
-- INSERTAR MÁS PREDICCIONES PARA TODOS LOS PRODUCTOS
-- ============================================================================

-- Obtener todos los productos que no tienen predicciones
INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date)
SELECT 
    p.id,
    NULL,
    'month',
    GREATEST(10, COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id), 0) * 0.3),
    ROUND(70 + RAND() * 20, 1),
    'moving_average',
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
FROM products p
WHERE p.id NOT IN (SELECT DISTINCT product_id FROM consumption_predictions WHERE area_id IS NULL AND prediction_period = 'month')
LIMIT 20;

-- Predicciones trimestrales para productos principales
INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date)
SELECT 
    product_id,
    NULL,
    'quarter',
    predicted_quantity * 3,
    confidence_level - 5,
    'linear_regression',
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
FROM consumption_predictions
WHERE prediction_period = 'month' AND area_id IS NULL
AND product_id NOT IN (SELECT DISTINCT product_id FROM consumption_predictions WHERE prediction_period = 'quarter' AND area_id IS NULL)
LIMIT 15;

-- Predicciones anuales para productos principales
INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date)
SELECT 
    product_id,
    NULL,
    'year',
    predicted_quantity * 12,
    confidence_level - 10,
    'linear_regression',
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    DATE_ADD(CURDATE(), INTERVAL 12 MONTH)
FROM consumption_predictions
WHERE prediction_period = 'month' AND area_id IS NULL
AND product_id NOT IN (SELECT DISTINCT product_id FROM consumption_predictions WHERE prediction_period = 'year' AND area_id IS NULL)
LIMIT 10;

-- Predicciones por área para productos principales
INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date)
SELECT 
    cp.product_id,
    @urgencias_id,
    'month',
    ROUND(cp.predicted_quantity * 0.3, 0),
    cp.confidence_level - 5,
    'moving_average',
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
FROM consumption_predictions cp
WHERE cp.prediction_period = 'month' AND cp.area_id IS NULL
AND cp.product_id NOT IN (SELECT DISTINCT product_id FROM consumption_predictions WHERE area_id = @urgencias_id AND prediction_period = 'month')
LIMIT 10;

INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date)
SELECT 
    cp.product_id,
    @cirugia_id,
    'month',
    ROUND(cp.predicted_quantity * 0.2, 0),
    cp.confidence_level - 5,
    'moving_average',
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
FROM consumption_predictions cp
WHERE cp.prediction_period = 'month' AND cp.area_id IS NULL
AND cp.product_id NOT IN (SELECT DISTINCT product_id FROM consumption_predictions WHERE area_id = @cirugia_id AND prediction_period = 'month')
LIMIT 8;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

SELECT '=== RESUMEN DE DATOS INSERTADOS ===' as Info;

SELECT 
    'Productos totales:' as Resumen,
    COUNT(*) as Cantidad 
FROM products
UNION ALL
SELECT 
    'Lotes totales:' as Resumen,
    COUNT(*) as Cantidad 
FROM product_batches
UNION ALL
SELECT 
    'Movimientos de stock:' as Resumen,
    COUNT(*) as Cantidad 
FROM stock_history
UNION ALL
SELECT 
    'Predicciones totales:' as Resumen,
    COUNT(*) as Cantidad 
FROM consumption_predictions
UNION ALL
SELECT 
    'Alertas activas:' as Resumen,
    COUNT(*) as Cantidad 
FROM stock_alerts WHERE is_resolved = FALSE;

-- Mostrar distribución de alertas por tipo
SELECT 
    alert_type as 'Tipo de Alerta',
    severity as 'Severidad',
    COUNT(*) as 'Cantidad'
FROM stock_alerts
WHERE is_resolved = FALSE
GROUP BY alert_type, severity
ORDER BY 
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- Mostrar productos con diferentes estados
SELECT 
    'Productos vencidos:' as Estado,
    COUNT(DISTINCT pb.product_id) as Cantidad
FROM product_batches pb
WHERE pb.expiry_date < CURDATE()
UNION ALL
SELECT 
    'Productos por vencer (15-30 días):' as Estado,
    COUNT(DISTINCT pb.product_id) as Cantidad
FROM product_batches pb
WHERE pb.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
UNION ALL
SELECT 
    'Productos con stock bajo:' as Estado,
    COUNT(DISTINCT p.id) as Cantidad
FROM products p
WHERE (SELECT COALESCE(SUM(pb.quantity), 0) FROM product_batches pb WHERE pb.product_id = p.id) < p.min_stock;

