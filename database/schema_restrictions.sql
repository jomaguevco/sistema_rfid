-- ============================================================================
-- Sistema de Restricciones de Medicamentos
-- ============================================================================
-- 
-- Este archivo contiene las tablas para gestionar restricciones de medicamentos
-- por área y por tipo de especialista
-- 
-- Uso: mysql -u root -p rfid_stock_db < database/schema_restrictions.sql
-- ============================================================================

USE rfid_stock_db;

-- Tabla de restricciones de medicamentos por área
CREATE TABLE IF NOT EXISTS product_area_restrictions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    area_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_area (product_id, area_id),
    INDEX idx_product_id (product_id),
    INDEX idx_area_id (area_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de restricciones de medicamentos por tipo de especialista
CREATE TABLE IF NOT EXISTS product_specialist_restrictions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    specialist_type VARCHAR(100) NOT NULL COMMENT 'Tipo de especialista (ej: cardiologo, pediatra, etc.)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_specialist (product_id, specialist_type),
    INDEX idx_product_id (product_id),
    INDEX idx_specialist_type (specialist_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar campo specialist_type a la tabla users si no existe
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS specialist_type VARCHAR(100) NULL COMMENT 'Tipo de especialista del usuario médico';

-- Tabla de asignación de medicamentos a áreas (medicamentos disponibles por área)
CREATE TABLE IF NOT EXISTS area_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    area_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_area_product (area_id, product_id),
    INDEX idx_area_id (area_id),
    INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- NOTAS
-- ============================================================================
-- 
-- product_area_restrictions: Define qué medicamentos NO pueden ser usados en ciertas áreas
-- product_specialist_restrictions: Define qué medicamentos solo pueden ser prescritos por ciertos especialistas
-- area_products: Define qué medicamentos están disponibles/asignados a cada área
-- 
-- ============================================================================

