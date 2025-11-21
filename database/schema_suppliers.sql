-- ============================================================================
-- Gestión de Proveedores y Órdenes de Compra
-- ============================================================================
-- 
-- Este archivo agrega las tablas necesarias para gestión de proveedores y órdenes
-- Uso: mysql -u root -p rfid_stock_db < database/schema_suppliers.sql
-- ============================================================================

USE rfid_stock_db;

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    tax_id VARCHAR(100) COMMENT 'NIT/RUC/ID Fiscal',
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_is_active (is_active),
    INDEX idx_tax_id (tax_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de órdenes de compra
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    order_number VARCHAR(100) NOT NULL UNIQUE,
    order_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'received', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10, 2) DEFAULT 0.00,
    notes TEXT,
    created_by INT COMMENT 'Usuario que creó la orden',
    approved_by INT COMMENT 'Usuario que aprobó la orden',
    approved_at TIMESTAMP NULL,
    received_by INT COMMENT 'Usuario que recibió la orden',
    received_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
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
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    received_quantity INT DEFAULT 0 COMMENT 'Cantidad recibida',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de recepciones (registro de recepción de órdenes)
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

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Insertar algunos proveedores de ejemplo
INSERT IGNORE INTO suppliers (name, contact_person, email, phone, address, tax_id, is_active) VALUES
('Farmacéutica Nacional S.A.', 'Juan Pérez', 'contacto@farmaceuticanacional.com', '+502 1234-5678', 'Ciudad de Guatemala', '12345678-9', TRUE),
('Distribuidora Médica Central', 'María González', 'ventas@distribuidoramedica.com', '+502 2345-6789', 'Antigua Guatemala', '23456789-0', TRUE),
('Suministros Hospitalarios Ltda.', 'Carlos Rodríguez', 'info@suministroshospitalarios.com', '+502 3456-7890', 'Quetzaltenango', '34567890-1', TRUE);

