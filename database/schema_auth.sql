-- ============================================================================
-- Sistema de Autenticación y Usuarios
-- ============================================================================
-- 
-- Este archivo agrega las tablas necesarias para el sistema de autenticación
-- Uso: mysql -u root -p rfid_stock_db < database/schema_auth.sql
-- ============================================================================

USE rfid_stock_db;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'farmaceutico', 'enfermero', 'supervisor', 'auditor', 'despacho') NOT NULL DEFAULT 'enfermero',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    INDEX idx_token (token),
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
    role ENUM('admin', 'farmaceutico', 'enfermero', 'supervisor', 'auditor', 'despacho') NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role, permission_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de logs de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL COMMENT 'NULL si es acción del sistema',
    action VARCHAR(100) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.',
    table_name VARCHAR(100) NOT NULL COMMENT 'Nombre de la tabla afectada',
    record_id INT NULL COMMENT 'ID del registro afectado',
    old_values JSON NULL COMMENT 'Valores anteriores (para UPDATE/DELETE)',
    new_values JSON NULL COMMENT 'Valores nuevos (para CREATE/UPDATE)',
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
-- DATOS INICIALES
-- ============================================================================

-- Insertar permisos del sistema
INSERT IGNORE INTO permissions (name, description) VALUES
('products.create', 'Crear productos'),
('products.read', 'Ver productos'),
('products.update', 'Editar productos'),
('products.delete', 'Eliminar productos'),
('batches.create', 'Crear lotes'),
('batches.read', 'Ver lotes'),
('batches.update', 'Editar lotes'),
('batches.delete', 'Eliminar lotes'),
('categories.manage', 'Gestionar categorías'),
('areas.manage', 'Gestionar áreas'),
('alerts.view', 'Ver alertas'),
('alerts.resolve', 'Resolver alertas'),
('predictions.view', 'Ver predicciones'),
('predictions.generate', 'Generar predicciones'),
('reports.view', 'Ver reportes'),
('reports.export', 'Exportar reportes'),
('users.manage', 'Gestionar usuarios'),
('audit.view', 'Ver logs de auditoría'),
('backup.manage', 'Gestionar backups'),
('import.data', 'Importar datos'),
('suppliers.manage', 'Gestionar proveedores'),
('orders.manage', 'Gestionar órdenes de compra');

-- Asignar permisos a roles
-- Admin: todos los permisos
INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- Farmaceutico: gestión completa de productos, lotes, alertas, predicciones
INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'farmaceutico', id FROM permissions 
WHERE name IN (
    'products.create', 'products.read', 'products.update', 'products.delete',
    'batches.create', 'batches.read', 'batches.update', 'batches.delete',
    'categories.manage', 'areas.manage',
    'alerts.view', 'alerts.resolve',
    'predictions.view', 'predictions.generate',
    'reports.view', 'reports.export',
    'suppliers.manage', 'orders.manage'
);

-- Enfermero: lectura y retiro de productos
INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'enfermero', id FROM permissions 
WHERE name IN (
    'products.read', 'batches.read',
    'alerts.view', 'reports.view'
);

-- Supervisor: gestión y reportes
INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'supervisor', id FROM permissions 
WHERE name IN (
    'products.create', 'products.read', 'products.update',
    'batches.create', 'batches.read', 'batches.update',
    'categories.manage', 'areas.manage',
    'alerts.view', 'alerts.resolve',
    'predictions.view', 'predictions.generate',
    'reports.view', 'reports.export',
    'audit.view'
);

-- Auditor: solo lectura y auditoría
INSERT IGNORE INTO role_permissions (role, permission_id)
SELECT 'auditor', id FROM permissions 
WHERE name IN (
    'products.read', 'batches.read',
    'alerts.view', 'reports.view', 'reports.export',
    'audit.view'
);

-- Crear usuario administrador por defecto (password: admin123)
-- La contraseña será hasheada en el backend al crear el usuario
INSERT IGNORE INTO users (username, email, password_hash, role, is_active) VALUES
('admin', 'admin@sistema.com', '$2b$10$rQ8K8K8K8K8K8K8K8K8K8uK8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K', 'admin', TRUE);

-- Nota: La contraseña hash anterior es un placeholder. 
-- El usuario admin real se creará con contraseña hasheada correctamente desde el backend.

