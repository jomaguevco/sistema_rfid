-- ============================================================================
-- Script SQL MASIVO para poblar TODAS las tablas con datos realistas
-- Asegura que todos los productos tengan lotes con números de lote
-- 
-- Uso: mysql -u root -p rfid_stock_db < database/populate_massive_data.sql
-- ============================================================================

USE rfid_stock_db;

-- ============================================================================
-- 1. CRÍTICO: Crear lotes para TODOS los productos con números de lote
-- ============================================================================

-- Insertar lotes para productos que no los tengan
INSERT INTO product_batches (product_id, lot_number, rfid_uid, expiry_date, quantity, entry_date, created_at)
SELECT 
    p.id,
    CONCAT('LOT-', LPAD(p.id, 6, '0'), '-', DATE_FORMAT(NOW(), '%Y%m%d')) as lot_number,
    CASE 
        WHEN RAND() > 0.3 THEN CONCAT('PROD-', LPAD(p.id, 8, '0'), '-', 
            CONCAT(
                CHAR(65 + FLOOR(RAND() * 26)),
                CHAR(65 + FLOOR(RAND() * 26)),
                CHAR(65 + FLOOR(RAND() * 26)),
                CHAR(65 + FLOOR(RAND() * 26))
            ))
        ELSE NULL
    END as rfid_uid,
    DATE_ADD(CURDATE(), INTERVAL (6 + FLOOR(RAND() * 18)) MONTH) as expiry_date,
    (p.min_stock * (5 + FLOOR(RAND() * 10))) as quantity,
    CURDATE() as entry_date,
    NOW() as created_at
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM product_batches pb WHERE pb.product_id = p.id
);

-- Actualizar lotes que no tengan número de lote
UPDATE product_batches pb
INNER JOIN products p ON pb.product_id = p.id
SET pb.lot_number = CONCAT('LOT-', LPAD(p.id, 6, '0'), '-', DATE_FORMAT(NOW(), '%Y%m%d'))
WHERE pb.lot_number IS NULL OR pb.lot_number = '';

-- ============================================================================
-- 2. POBLAR SUPPLIERS (Proveedores)
-- ============================================================================

INSERT IGNORE INTO suppliers (name, contact_person, email, phone, address, tax_id, is_active) VALUES
('Farmacéutica Nacional S.A.', 'Juan Pérez', 'contacto@farmanacional.com', '01-234-5678', 'Av. Principal 123, Lima', '20123456789', TRUE),
('Medicamentos del Perú S.A.C.', 'María González', 'ventas@medperu.com', '01-345-6789', 'Jr. Los Olivos 456, Lima', '20234567890', TRUE),
('Distribuidora Médica Integral', 'Carlos Ramírez', 'info@dmi.com.pe', '01-456-7890', 'Av. Libertad 789, Lima', '20345678901', TRUE),
('Insumos Médicos Premium', 'Ana López', 'contacto@insumospremium.com', '01-567-8901', 'Calle Real 321, Lima', '20456789012', TRUE),
('Farmacéutica Internacional', 'Roberto Sánchez', 'ventas@farmainternacional.com', '01-678-9012', 'Av. San Martín 654, Lima', '20567890123', TRUE),
('Equipos Médicos Especializados', 'Laura Torres', 'info@equiposmedicos.com', '01-789-0123', 'Jr. Unión 987, Lima', '20678901234', TRUE),
('Laboratorios Farmacéuticos Unidos', 'Miguel Vásquez', 'contacto@labunidos.com', '01-890-1234', 'Av. Progreso 147, Lima', '20789012345', TRUE),
('Distribuidora de Medicamentos Genericos', 'Carmen Castro', 'ventas@medgenericos.com', '01-901-2345', 'Calle Bolívar 258, Lima', '20890123456', TRUE),
('Insumos Hospitalarios S.A.', 'Fernando Morales', 'info@insumoshospital.com', '01-012-3456', 'Av. América 369, Lima', '20901234567', TRUE),
('Farmacéutica Andina', 'Patricia Jiménez', 'contacto@farmaandina.com', '01-123-4567', 'Jr. Independencia 741, Lima', '20112345678', TRUE),
('Medicamentos Especializados S.A.', 'Luis Ramírez', 'ventas@medespecializados.com', '01-234-5678', 'Av. Central 852, Lima', '20123456789', TRUE),
('Distribuidora Farmacéutica del Sur', 'Rosa Jiménez', 'info@farmasur.com', '01-345-6789', 'Calle Principal 963, Lima', '20134567890', TRUE),
('Laboratorios Nacionales', 'Jorge Mendoza', 'contacto@labnacional.com', '01-456-7890', 'Av. Los Héroes 159, Lima', '20145678901', TRUE),
('Insumos Quirúrgicos Premium', 'Silvia Rojas', 'ventas@insumosquirurgicos.com', '01-567-8901', 'Jr. La Paz 357, Lima', '20156789012', TRUE),
('Farmacéutica del Pacífico', 'Ricardo Flores', 'info@farmapacifico.com', '01-678-9012', 'Av. La Victoria 468, Lima', '20167890123', TRUE);

-- ============================================================================
-- 3. POBLAR PURCHASE_ORDERS (Órdenes de Compra)
-- ============================================================================

-- Crear órdenes de compra (solo si hay proveedores y productos)
INSERT INTO purchase_orders (supplier_id, order_number, order_date, status, total_amount, created_by)
SELECT 
    s.id as supplier_id,
    CONCAT('OC-', YEAR(CURDATE()), '-', LPAD(@row_number := @row_number + 1, 4, '0')) as order_number,
    DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 180) DAY) as order_date,
    ELT(1 + FLOOR(RAND() * 4), 'pending', 'approved', 'ordered', 'received') as status,
    0 as total_amount,
    (SELECT id FROM users LIMIT 1) as created_by
FROM suppliers s
CROSS JOIN (SELECT @row_number := (SELECT COALESCE(MAX(CAST(SUBSTRING(order_number, -4) AS UNSIGNED)), 0) FROM purchase_orders)) AS r
WHERE (SELECT COUNT(*) FROM purchase_orders) < 30
LIMIT 30;

-- Crear items para las órdenes
INSERT INTO purchase_order_items (order_id, product_id, quantity, unit_price, total_price)
SELECT 
    po.id as order_id,
    p.id as product_id,
    (10 + FLOOR(RAND() * 90)) as quantity,
    ROUND(10 + (RAND() * 90), 2) as unit_price,
    ROUND((10 + FLOOR(RAND() * 90)) * (10 + (RAND() * 90)), 2) as total_price
FROM purchase_orders po
CROSS JOIN (SELECT id FROM products ORDER BY RAND() LIMIT 3) p
WHERE NOT EXISTS (
    SELECT 1 FROM purchase_order_items poi WHERE poi.order_id = po.id
)
LIMIT 90;

-- Actualizar totales de las órdenes
UPDATE purchase_orders po
SET total_amount = (
    SELECT COALESCE(SUM(total_price), 0)
    FROM purchase_order_items poi
    WHERE poi.order_id = po.id
)
WHERE po.total_amount = 0;

-- ============================================================================
-- 4. POBLAR PRESCRIPTIONS (Recetas)
-- ============================================================================

-- Crear recetas (solo si hay doctores y pacientes)
INSERT INTO prescriptions (prescription_code, patient_name, patient_id, patient_id_number, doctor_name, doctor_license, doctor_id, prescription_date, status, created_by)
SELECT 
    CONCAT('REC-', YEAR(CURDATE()), '-', LPAD(@rec_number := @rec_number + 1, 4, '0')) as prescription_code,
    pt.name as patient_name,
    pt.id as patient_id,
    pt.id_number as patient_id_number,
    d.name as doctor_name,
    d.license_number as doctor_license,
    d.id as doctor_id,
    DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 60) DAY) as prescription_date,
    ELT(1 + FLOOR(RAND() * 3), 'pending', 'partial', 'fulfilled') as status,
    (SELECT id FROM users LIMIT 1) as created_by
FROM patients pt
CROSS JOIN doctors d
CROSS JOIN (SELECT @rec_number := (SELECT COALESCE(MAX(CAST(SUBSTRING(prescription_code, -4) AS UNSIGNED)), 0) FROM prescriptions)) AS r
WHERE (SELECT COUNT(*) FROM prescriptions) < 50
ORDER BY RAND()
LIMIT 50;

-- Crear items para las recetas
INSERT INTO prescription_items (prescription_id, product_id, quantity_required, quantity_dispensed, instructions)
SELECT 
    pr.id as prescription_id,
    p.id as product_id,
    (1 + FLOOR(RAND() * 3)) as quantity_required,
    CASE 
        WHEN pr.status = 'fulfilled' THEN (1 + FLOOR(RAND() * 3))
        WHEN pr.status = 'partial' THEN FLOOR((1 + FLOOR(RAND() * 3)) / 2)
        ELSE 0
    END as quantity_dispensed,
    ELT(1 + FLOOR(RAND() * 5), 
        '1 tableta cada 8 horas',
        '1 tableta cada 12 horas',
        '1 tableta cada 6 horas',
        '2 tabletas al día',
        '1 tableta antes de las comidas'
    ) as instructions
FROM prescriptions pr
CROSS JOIN (SELECT id FROM products WHERE product_type = 'medicamento' ORDER BY RAND() LIMIT 2) p
WHERE NOT EXISTS (
    SELECT 1 FROM prescription_items pi WHERE pi.prescription_id = pr.id
)
LIMIT 100;

-- ============================================================================
-- 5. POBLAR PERMISSIONS (Permisos)
-- ============================================================================

INSERT IGNORE INTO permissions (name, description) VALUES
('products.create', 'Crear productos'),
('products.update', 'Actualizar productos'),
('products.delete', 'Eliminar productos'),
('products.view', 'Ver productos'),
('prescriptions.create', 'Crear recetas'),
('prescriptions.update', 'Actualizar recetas'),
('prescriptions.delete', 'Eliminar recetas'),
('prescriptions.view', 'Ver recetas'),
('stock.entry', 'Registrar entrada de stock'),
('stock.exit', 'Registrar salida de stock'),
('users.manage', 'Gestionar usuarios'),
('reports.view', 'Ver reportes'),
('reports.generate', 'Generar reportes'),
('admin.access', 'Acceso a panel de administración');

-- ============================================================================
-- 6. POBLAR ROLE_PERMISSIONS
-- ============================================================================

-- Asignar todos los permisos a admin
INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- Asignar permisos a farmaceutico
INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'farmaceutico', id FROM permissions 
WHERE name IN (
    'products.view', 'products.create', 'products.update',
    'prescriptions.view', 'prescriptions.create', 'prescriptions.update',
    'stock.entry', 'stock.exit', 'reports.view'
);

-- ============================================================================
-- 7. POBLAR SYSTEM_CONFIG
-- ============================================================================

INSERT IGNORE INTO system_config (config_key, config_value, config_type, description, category) VALUES
('stock.alert_threshold', '10', 'number', 'Umbral mínimo para alertas de stock', 'alerts'),
('stock.expiry_warning_days', '30', 'number', 'Días antes del vencimiento para alertar', 'alerts'),
('system.name', 'Sistema Hospitalario de Gestión', 'string', 'Nombre del sistema', 'general'),
('notifications.email_enabled', 'true', 'boolean', 'Habilitar notificaciones por email', 'notifications'),
('reports.default_format', 'pdf', 'string', 'Formato por defecto para reportes', 'reports');

-- ============================================================================
-- 8. POBLAR STOCK_HISTORY
-- ============================================================================

INSERT INTO stock_history (product_id, batch_id, area_id, movement_type, quantity, notes, created_by, created_at)
SELECT 
    pb.product_id,
    pb.id as batch_id,
    a.id as area_id,
    ELT(1 + FLOOR(RAND() * 2), 'entry', 'exit') as movement_type,
    (1 + FLOOR(RAND() * 20)) as quantity,
    CONCAT('Movimiento ', ELT(1 + FLOOR(RAND() * 2), 'de entrada', 'de salida'), ' generado automáticamente') as notes,
    (SELECT id FROM users LIMIT 1) as created_by,
    DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 90) DAY) as created_at
FROM product_batches pb
CROSS JOIN areas a
WHERE (SELECT COUNT(*) FROM stock_history) < 100
ORDER BY RAND()
LIMIT 100;

-- ============================================================================
-- RESUMEN
-- ============================================================================

SELECT 'Productos' as tabla, COUNT(*) as total FROM products
UNION ALL
SELECT 'Lotes', COUNT(*) FROM product_batches
UNION ALL
SELECT 'Lotes con número', COUNT(*) FROM product_batches WHERE lot_number IS NOT NULL AND lot_number != ''
UNION ALL
SELECT 'Proveedores', COUNT(*) FROM suppliers
UNION ALL
SELECT 'Órdenes de Compra', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'Items de Órdenes', COUNT(*) FROM purchase_order_items
UNION ALL
SELECT 'Recetas', COUNT(*) FROM prescriptions
UNION ALL
SELECT 'Items de Receta', COUNT(*) FROM prescription_items
UNION ALL
SELECT 'Permisos', COUNT(*) FROM permissions
UNION ALL
SELECT 'Configuraciones', COUNT(*) FROM system_config
UNION ALL
SELECT 'Historial de Stock', COUNT(*) FROM stock_history;

