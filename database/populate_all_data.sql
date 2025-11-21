-- ============================================================================
-- Script para poblar todas las tablas con datos de ejemplo
-- ============================================================================
-- 
-- Este script agrega datos realistas a todas las tablas del sistema
-- Uso: mysql -u root -p rfid_stock_db < database/populate_all_data.sql
-- ============================================================================

USE rfid_stock_db;

-- ============================================================================
-- 1. QUÍMICOS FARMACÉUTICOS
-- ============================================================================

-- Crear tabla de químicos farmacéuticos si no existe
CREATE TABLE IF NOT EXISTS pharmacists (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL COMMENT 'Nombre completo del químico farmacéutico',
    id_number VARCHAR(100) UNIQUE COMMENT 'DNI o número de identificación',
    license_number VARCHAR(100) UNIQUE COMMENT 'Número de colegiatura o licencia',
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_id_number (id_number),
    INDEX idx_license_number (license_number),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar químicos farmacéuticos
INSERT IGNORE INTO pharmacists (name, id_number, license_number, email, phone) VALUES
('María Elena Rodríguez', '12345678', 'CQF-001234', 'maria.rodriguez@hospital.com', '987654321'),
('Carlos Alberto Méndez', '23456789', 'CQF-002345', 'carlos.mendez@hospital.com', '987654322'),
('Ana Patricia López', '34567890', 'CQF-003456', 'ana.lopez@hospital.com', '987654323'),
('Roberto José García', '45678901', 'CQF-004567', 'roberto.garcia@hospital.com', '987654324'),
('Laura Beatriz Sánchez', '56789012', 'CQF-005678', 'laura.sanchez@hospital.com', '987654325');

-- ============================================================================
-- 2. USUARIOS CON ROL DE QUÍMICO FARMACÉUTICO
-- ============================================================================

-- Insertar usuarios químicos farmacéuticos (password: quimico123)
INSERT IGNORE INTO users (username, email, password_hash, role, is_active) VALUES
('quimico1', 'maria.rodriguez@hospital.com', '$2b$10$rQ8K9J7L5M3N1P2Q4R6S8T0U2V4W6X8Y0Z2A4B6C8D0E2F4G6H8I0J2K4L6M8', 'farmaceutico', TRUE),
('quimico2', 'carlos.mendez@hospital.com', '$2b$10$rQ8K9J7L5M3N1P2Q4R6S8T0U2V4W6X8Y0Z2A4B6C8D0E2F4G6H8I0J2K4L6M8', 'farmaceutico', TRUE),
('quimico3', 'ana.lopez@hospital.com', '$2b$10$rQ8K9J7L5M3N1P2Q4R6S8T0U2V4W6X8Y0Z2A4B6C8D0E2F4G6H8I0J2K4L6M8', 'farmaceutico', TRUE);

-- ============================================================================
-- 3. DOCTORES CON ÁREAS Y ESPECIALIDADES
-- ============================================================================

-- Insertar doctores asociados a áreas
INSERT IGNORE INTO doctors (name, license_number, specialty, area_id, email, phone) VALUES
-- Urgencias
('Dr. Juan Carlos Pérez', 'CM-001234', 'Medicina de Emergencias', 1, 'juan.perez@hospital.com', '987654101'),
('Dra. María Fernanda Torres', 'CM-002345', 'Medicina de Emergencias', 1, 'maria.torres@hospital.com', '987654102'),
-- Cirugía
('Dr. Luis Alberto Ramírez', 'CM-003456', 'Cirugía General', 2, 'luis.ramirez@hospital.com', '987654103'),
('Dra. Carmen Rosa Vásquez', 'CM-004567', 'Cirugía General', 2, 'carmen.vasquez@hospital.com', '987654104'),
-- Pediatría
('Dra. Patricia Elena Morales', 'CM-005678', 'Pediatría', 3, 'patricia.morales@hospital.com', '987654105'),
('Dr. Fernando José Castro', 'CM-006789', 'Pediatría', 3, 'fernando.castro@hospital.com', '987654106'),
-- Maternidad
('Dra. Rosa María Jiménez', 'CM-007890', 'Ginecología y Obstetricia', 4, 'rosa.jimenez@hospital.com', '987654107'),
('Dr. Miguel Ángel Herrera', 'CM-008901', 'Ginecología y Obstetricia', 4, 'miguel.herrera@hospital.com', '987654108'),
-- Farmacia (Medicina General)
('Dr. Jorge Luis Mendoza', 'CM-009012', 'Medicina General', NULL, 'jorge.mendoza@hospital.com', '987654109'),
('Dra. Silvia Beatriz Rojas', 'CM-010123', 'Medicina General', NULL, 'silvia.rojas@hospital.com', '987654110'),
-- Enfermería (Medicina General)
('Dr. Ricardo Antonio Flores', 'CM-011234', 'Medicina General', NULL, 'ricardo.flores@hospital.com', '987654111'),
-- Cardiología (sin área específica, medicina general)
('Dr. Eduardo Manuel Díaz', 'CM-012345', 'Cardiología', NULL, 'eduardo.diaz@hospital.com', '987654112'),
('Dra. Gabriela Isabel Ruiz', 'CM-013456', 'Cardiología', NULL, 'gabriela.ruiz@hospital.com', '987654113'),
-- Neurología
('Dr. Andrés Felipe Vargas', 'CM-014567', 'Neurología', NULL, 'andres.vargas@hospital.com', '987654114'),
-- Traumatología
('Dr. Diego Armando Soto', 'CM-015678', 'Traumatología', NULL, 'diego.soto@hospital.com', '987654115');

-- ============================================================================
-- 4. PACIENTES
-- ============================================================================

INSERT IGNORE INTO patients (name, id_number, date_of_birth, gender, phone, email, address) VALUES
('Jose Mariano Guevara Cotrina', '72114106', '1985-05-15', 'M', '987654321', 'jose.guevara@email.com', 'Av. Principal 123'),
('María Elena Fernández', '12345678', '1990-03-20', 'F', '987654322', 'maria.fernandez@email.com', 'Jr. Los Olivos 456'),
('Carlos Alberto Mendoza', '23456789', '1988-07-10', 'M', '987654323', 'carlos.mendoza@email.com', 'Av. Libertad 789'),
('Ana Patricia López', '34567890', '1992-11-25', 'F', '987654324', 'ana.lopez@email.com', 'Calle Real 321'),
('Roberto José García', '45678901', '1987-09-05', 'M', '987654325', 'roberto.garcia@email.com', 'Av. San Martín 654'),
('Laura Beatriz Sánchez', '56789012', '1995-01-30', 'F', '987654326', 'laura.sanchez@email.com', 'Jr. Unión 987'),
('Miguel Ángel Torres', '67890123', '1983-12-18', 'M', '987654327', 'miguel.torres@email.com', 'Av. Progreso 147'),
('Carmen Rosa Vásquez', '78901234', '1991-06-22', 'F', '987654328', 'carmen.vasquez@email.com', 'Calle Bolívar 258'),
('Fernando José Castro', '89012345', '1989-04-14', 'M', '987654329', 'fernando.castro@email.com', 'Av. América 369'),
('Patricia Elena Morales', '90123456', '1993-08-08', 'F', '987654330', 'patricia.morales@email.com', 'Jr. Independencia 741'),
('Luis Alberto Ramírez', '01234567', '1986-02-28', 'M', '987654331', 'luis.ramirez@email.com', 'Av. Central 852'),
('Rosa María Jiménez', '11223344', '1994-10-12', 'F', '987654332', 'rosa.jimenez@email.com', 'Calle Principal 963'),
('Jorge Luis Mendoza', '22334455', '1984-07-03', 'M', '987654333', 'jorge.mendoza@email.com', 'Av. Los Héroes 159'),
('Silvia Beatriz Rojas', '33445566', '1990-05-19', 'F', '987654334', 'silvia.rojas@email.com', 'Jr. La Paz 357'),
('Ricardo Antonio Flores', '44556677', '1987-11-07', 'M', '987654335', 'ricardo.flores@email.com', 'Av. La Victoria 468');

-- ============================================================================
-- 5. ASIGNAR ÁREAS A PRODUCTOS
-- ============================================================================

-- Actualizar algunos productos con áreas específicas
UPDATE products SET area_id = 1 WHERE name LIKE '%Amoxicilina%' OR name LIKE '%Penicilina%'; -- Urgencias
UPDATE products SET area_id = 2 WHERE name LIKE '%Suturas%' OR name LIKE '%Tijeras%' OR name LIKE '%Pinzas%'; -- Cirugía
UPDATE products SET area_id = 3 WHERE name LIKE '%Pediatría%' OR name LIKE '%Infantil%'; -- Pediatría
UPDATE products SET area_id = 4 WHERE name LIKE '%Maternidad%' OR name LIKE '%Obstetricia%'; -- Maternidad
UPDATE products SET area_id = 5 WHERE id % 10 = 0; -- Farmacia (algunos productos)
UPDATE products SET area_id = 6 WHERE name LIKE '%Enfermería%' OR name LIKE '%Curación%'; -- Enfermería

-- ============================================================================
-- 6. RESTRICCIONES DE ESPECIALIDAD POR PRODUCTO
-- ============================================================================

-- Obtener algunos productos y asignar restricciones
-- Productos cardiovasculares solo para cardiólogos
INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id)
SELECT id, 'Cardiología', NULL
FROM products
WHERE name LIKE '%Enalapril%' OR name LIKE '%Amlodipino%' OR name LIKE '%Metoprolol%' OR name LIKE '%Warfarina%' OR name LIKE '%Aspirina%'
LIMIT 20;

-- Productos pediátricos solo para pediatras
INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id)
SELECT id, 'Pediatría', NULL
FROM products
WHERE name LIKE '%Pediatría%' OR name LIKE '%Infantil%' OR (concentration LIKE '%mg%' AND concentration LIKE '%pediátrico%')
LIMIT 15;

-- Productos de cirugía solo para cirujanos
INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id)
SELECT id, 'Cirugía General', 2
FROM products
WHERE name LIKE '%Suturas%' OR name LIKE '%Tijeras%' OR name LIKE '%Pinzas%' OR name LIKE '%Quirúrgico%'
LIMIT 10;

-- Productos de urgencias solo para médicos de emergencias
INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id)
SELECT id, 'Medicina de Emergencias', 1
FROM products
WHERE name LIKE '%Urgencia%' OR name LIKE '%Emergencia%' OR (product_type = 'medicamento' AND id % 7 = 0)
LIMIT 15;

-- Productos de ginecología solo para ginecólogos
INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id)
SELECT id, 'Ginecología y Obstetricia', 4
FROM products
WHERE name LIKE '%Ginecología%' OR name LIKE '%Obstetricia%' OR name LIKE '%Maternidad%'
LIMIT 8;

-- ============================================================================
-- 7. VERIFICAR Y MOSTRAR RESUMEN
-- ============================================================================

SELECT 'Químicos Farmacéuticos' as tabla, COUNT(*) as total FROM pharmacists
UNION ALL
SELECT 'Doctores', COUNT(*) FROM doctors
UNION ALL
SELECT 'Pacientes', COUNT(*) FROM patients
UNION ALL
SELECT 'Productos con área', COUNT(*) FROM products WHERE area_id IS NOT NULL
UNION ALL
SELECT 'Restricciones de especialidad', COUNT(*) FROM product_specialty_restrictions
UNION ALL
SELECT 'Usuarios Químicos', COUNT(*) FROM users WHERE role = 'farmaceutico';

