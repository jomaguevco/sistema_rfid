-- ============================================================================
-- Sistema de Gestión de Stock de Medicamentos e Insumos Médicos con RFID
-- Base de datos completa y unificada
-- ============================================================================
-- 
-- Este archivo contiene:
-- 1. Creación de la base de datos
-- 2. Todas las tablas del sistema médico
-- 3. Índices y relaciones
-- 4. Datos iniciales (categorías, áreas, productos de ejemplo)
-- 5. Scripts de migración/actualización (comentados)
--
-- Uso: mysql -u root -p < database/schema_medical.sql
-- ============================================================================

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS rfid_stock_db;
USE rfid_stock_db;

-- ============================================================================
-- TABLAS PRINCIPALES
-- ============================================================================

-- Tabla de categorías médicas
CREATE TABLE IF NOT EXISTS product_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de áreas/departamentos médicos
CREATE TABLE IF NOT EXISTS areas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de productos (modificada para contexto médico)
CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    product_type ENUM('medicamento', 'insumo') NOT NULL DEFAULT 'medicamento',
    active_ingredient VARCHAR(255) COMMENT 'Principio activo',
    concentration VARCHAR(100) COMMENT 'Concentración (ej: 500mg)',
    presentation VARCHAR(100) COMMENT 'Presentación (ej: Tabletas, Ampollas)',
    administration_route VARCHAR(100) COMMENT 'Vía de administración',
    category_id INT,
    min_stock INT NOT NULL DEFAULT 5 COMMENT 'Stock mínimo para alertas',
    requires_refrigeration BOOLEAN DEFAULT FALSE,
    units_per_package INT DEFAULT 1 COMMENT 'Unidades por caja/paquete (ej: 10 pastillas por caja)',
    barcode VARCHAR(100) UNIQUE COMMENT 'Código de barras del producto',
    rfid_uid VARCHAR(50) UNIQUE COMMENT 'RFID principal (puede tener múltiples lotes)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL,
    INDEX idx_rfid_uid (rfid_uid),
    INDEX idx_barcode (barcode),
    INDEX idx_product_type (product_type),
    INDEX idx_category (category_id),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de lotes de productos
-- NOTA: is_expired y days_to_expiry se calculan en el backend al consultar
-- porque algunas versiones de MySQL/MariaDB no permiten CURDATE() en columnas generadas
CREATE TABLE IF NOT EXISTS product_batches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    lot_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    rfid_uid VARCHAR(50) UNIQUE COMMENT 'RFID asignado a este lote específico',
    entry_date DATE NOT NULL COMMENT 'Fecha de ingreso del lote',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_lot (product_id, lot_number),
    INDEX idx_product_id (product_id),
    INDEX idx_lot_number (lot_number),
    INDEX idx_rfid_uid (rfid_uid),
    INDEX idx_expiry_date (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para rastrear múltiples RFID físicos por lote
-- Permite que un lote tenga varios códigos RFID físicos asociados
CREATE TABLE IF NOT EXISTS batch_rfid_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  rfid_uid VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE CASCADE,
  UNIQUE KEY unique_batch_rfid (batch_id, rfid_uid),
  INDEX idx_rfid_uid (rfid_uid),
  INDEX idx_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de historial de stock (modificada para contexto médico)
CREATE TABLE IF NOT EXISTS stock_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    batch_id INT COMMENT 'ID del lote retirado',
    area_id INT COMMENT 'Área/departamento de donde se retiró',
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    action VARCHAR(50) NOT NULL COMMENT 'remove, add, update, restock',
    consumption_date DATE COMMENT 'Fecha de consumo para análisis temporal',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE SET NULL,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    INDEX idx_product_id (product_id),
    INDEX idx_batch_id (batch_id),
    INDEX idx_area_id (area_id),
    INDEX idx_action (action),
    INDEX idx_consumption_date (consumption_date),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de predicciones de consumo
CREATE TABLE IF NOT EXISTS consumption_predictions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    area_id INT NULL COMMENT 'NULL para predicción general, o ID de área específica',
    prediction_period ENUM('month', 'quarter', 'year') NOT NULL,
    predicted_quantity DECIMAL(10,2) NOT NULL,
    confidence_level DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Nivel de confianza 0-100',
    algorithm_used VARCHAR(50) DEFAULT 'moving_average',
    calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date DATE NOT NULL COMMENT 'Inicio del período predicho',
    end_date DATE NOT NULL COMMENT 'Fin del período predicho',
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_area_id (area_id),
    INDEX idx_prediction_period (prediction_period),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de alertas
CREATE TABLE IF NOT EXISTS stock_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    batch_id INT NULL COMMENT 'NULL si es alerta de producto, o ID de lote específico',
    alert_type ENUM('expired', 'expiring_soon', 'low_stock', 'prediction_insufficient', 'no_rfid') NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES product_batches(id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_alert_type (alert_type),
    INDEX idx_severity (severity),
    INDEX idx_is_resolved (is_resolved),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLAS DE USUARIOS Y AUTENTICACIÓN
-- ============================================================================

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'farmaceutico', 'farmaceutico_jefe', 'enfermero', 'supervisor', 'auditor', 'despacho') NOT NULL DEFAULT 'enfermero',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de sesiones de usuario
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token(100)),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de permisos por rol
CREATE TABLE IF NOT EXISTS role_permissions (
    role VARCHAR(50) NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role, permission_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de auditoría y logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT COMMENT 'Usuario que realizó la acción',
    action VARCHAR(100) NOT NULL COMMENT 'create, update, delete, login, logout, etc.',
    table_name VARCHAR(100) COMMENT 'Tabla afectada',
    record_id INT COMMENT 'ID del registro afectado',
    old_values JSON COMMENT 'Valores anteriores (para updates)',
    new_values JSON COMMENT 'Valores nuevos',
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_table_name (table_name),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLAS DE PROVEEDORES Y ÓRDENES DE COMPRA
-- ============================================================================

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(50) COMMENT 'RUC o NIT',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    order_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'ordered', 'received', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    created_by INT COMMENT 'Usuario que creó la orden',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_supplier_id (supplier_id),
    INDEX idx_order_number (order_number),
    INDEX idx_status (status),
    INDEX idx_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de items de órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de recepciones
CREATE TABLE IF NOT EXISTS receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    receipt_date DATE NOT NULL,
    received_by INT COMMENT 'Usuario que recibió',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_order_id (order_id),
    INDEX idx_receipt_date (receipt_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de configuración del sistema (parámetros globales)
CREATE TABLE IF NOT EXISTS system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(255) NOT NULL UNIQUE COMMENT 'Clave de configuración',
    config_value TEXT COMMENT 'Valor de configuración (puede ser JSON)',
    config_type ENUM('string', 'number', 'boolean', 'json', 'date') DEFAULT 'string',
    description TEXT COMMENT 'Descripción del parámetro',
    category VARCHAR(100) DEFAULT 'general' COMMENT 'Categoría: general, alerts, notifications, reports, etc.',
    is_editable BOOLEAN DEFAULT TRUE COMMENT 'Si puede ser editado desde la interfaz',
    updated_by INT COMMENT 'Usuario que actualizó por última vez',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_config_key (config_key),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de reportes programados
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_name VARCHAR(255) NOT NULL,
    report_type ENUM('expired', 'expiring', 'low_stock', 'traceability', 'consumption_by_area', 'predictions', 'custom') NOT NULL,
    schedule_type ENUM('daily', 'weekly', 'monthly', 'custom') NOT NULL,
    schedule_config JSON COMMENT 'Configuración del cron (día, hora, etc.)',
    recipients TEXT COMMENT 'Emails separados por coma',
    format ENUM('csv', 'excel', 'pdf', 'json') DEFAULT 'pdf',
    filters JSON COMMENT 'Filtros del reporte (fechas, productos, áreas, etc.)',
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP NULL COMMENT 'Última vez que se ejecutó',
    next_run_at TIMESTAMP NULL COMMENT 'Próxima ejecución programada',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_is_active (is_active),
    INDEX idx_next_run_at (next_run_at),
    INDEX idx_report_type (report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de ejecuciones de reportes programados
CREATE TABLE IF NOT EXISTS scheduled_report_executions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scheduled_report_id INT NOT NULL,
    execution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
    records_generated INT DEFAULT 0,
    file_path VARCHAR(500) COMMENT 'Ruta del archivo generado',
    error_message TEXT,
    execution_time_ms INT COMMENT 'Tiempo de ejecución en milisegundos',
    FOREIGN KEY (scheduled_report_id) REFERENCES scheduled_reports(id) ON DELETE CASCADE,
    INDEX idx_scheduled_report_id (scheduled_report_id),
    INDEX idx_execution_date (execution_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Insertar categorías médicas comunes
INSERT IGNORE INTO product_categories (name, description) VALUES
('Antibióticos', 'Medicamentos antibióticos de diversos tipos'),
('Analgésicos', 'Medicamentos para el tratamiento del dolor'),
('Antisépticos', 'Productos para desinfección y antisepsia'),
('Material de Curación', 'Gasas, vendas y apósitos para curaciones'),
('Equipos Médicos', 'Equipos y dispositivos médicos'),
('Medicamentos Cardiovasculares', 'Medicamentos para el sistema cardiovascular'),
('Medicamentos Respiratorios', 'Medicamentos para el sistema respiratorio'),
('Suplementos', 'Vitaminas y suplementos nutricionales');

-- Insertar áreas/departamentos comunes
INSERT IGNORE INTO areas (name, description) VALUES
('Urgencias', 'Departamento de urgencias médicas'),
('Cirugía', 'Área de cirugía general'),
('Pediatría', 'Departamento de pediatría'),
('Maternidad', 'Área de maternidad y obstetricia'),
('Farmacia', 'Farmacia del establecimiento'),
('Enfermería', 'Área de enfermería general'),
('Laboratorio', 'Laboratorio clínico'),
('Radiología', 'Departamento de radiología e imagenología');

-- Insertar algunos productos de ejemplo (opcional - comentar si no se desean)
INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock) VALUES
('Paracetamol 500mg', 'Analgésico y antipirético', 'medicamento', 'Paracetamol', '500mg', 'Tabletas', 'Oral', 2, 20),
('Gasas Estériles', 'Gasas estériles para curaciones', 'insumo', NULL, NULL, 'Unidades', 'Tópico', 4, 50),
('Amoxicilina 500mg', 'Antibiótico de amplio espectro', 'medicamento', 'Amoxicilina', '500mg', 'Cápsulas', 'Oral', 1, 15);

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 
-- Las columnas is_expired y days_to_expiry NO se almacenan en la base de datos.
-- Se calculan automáticamente en el backend al consultar los lotes usando:
--   - is_expired: (expiry_date < CURDATE())
--   - days_to_expiry: DATEDIFF(expiry_date, CURDATE())
--
-- Esto es necesario porque algunas versiones de MySQL/MariaDB no permiten
-- funciones como CURDATE() en columnas generadas (ni STORED ni VIRTUAL).
--
-- El backend (database_medical.js) ya incluye estos cálculos en todas las
-- consultas de lotes, por lo que la funcionalidad funciona correctamente.
--
-- ============================================================================

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================
-- 
-- Para verificar que todo se creó correctamente, ejecuta:
-- 
-- SHOW TABLES;
-- DESCRIBE product_batches;
-- SELECT COUNT(*) FROM product_categories;
-- SELECT COUNT(*) FROM areas;
-- SELECT COUNT(*) FROM products;
--
-- ============================================================================
