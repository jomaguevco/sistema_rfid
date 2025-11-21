/**
 * Script para poblar todas las tablas con datos de ejemplo
 * Incluye: químicos farmacéuticos, doctores, pacientes, restricciones, etc.
 */

const mysql = require('mysql2/promise');
const { hashPassword } = require('../utils/password');
require('dotenv').config();

async function populateData() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
      database: process.env.DB_NAME || 'rfid_stock_db',
      multipleStatements: true
    });

    console.log('✓ Conectado a la base de datos');

    // ============================================================================
    // 1. Crear tabla de químicos farmacéuticos
    // ============================================================================
    await connection.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Tabla pharmacists creada/verificada');

    // ============================================================================
    // 2. Insertar químicos farmacéuticos
    // ============================================================================
    const pharmacists = [
      { name: 'María Elena Rodríguez', id_number: '12345678', license_number: 'CQF-001234', email: 'maria.rodriguez@hospital.com', phone: '987654321' },
      { name: 'Carlos Alberto Méndez', id_number: '23456789', license_number: 'CQF-002345', email: 'carlos.mendez@hospital.com', phone: '987654322' },
      { name: 'Ana Patricia López', id_number: '34567890', license_number: 'CQF-003456', email: 'ana.lopez@hospital.com', phone: '987654323' },
      { name: 'Roberto José García', id_number: '45678901', license_number: 'CQF-004567', email: 'roberto.garcia@hospital.com', phone: '987654324' },
      { name: 'Laura Beatriz Sánchez', id_number: '56789012', license_number: 'CQF-005678', email: 'laura.sanchez@hospital.com', phone: '987654325' }
    ];

    for (const pharm of pharmacists) {
      await connection.execute(
        'INSERT IGNORE INTO pharmacists (name, id_number, license_number, email, phone) VALUES (?, ?, ?, ?, ?)',
        [pharm.name, pharm.id_number, pharm.license_number, pharm.email, pharm.phone]
      );
    }
    console.log(`✓ ${pharmacists.length} químicos farmacéuticos insertados`);

    // ============================================================================
    // 3. Crear usuarios químicos farmacéuticos
    // ============================================================================
    const passwordHash = await hashPassword('quimico123');
    const chemUsers = [
      { username: 'quimico1', email: 'maria.rodriguez@hospital.com', name: 'María Elena Rodríguez' },
      { username: 'quimico2', email: 'carlos.mendez@hospital.com', name: 'Carlos Alberto Méndez' },
      { username: 'quimico3', email: 'ana.lopez@hospital.com', name: 'Ana Patricia López' }
    ];

    for (const user of chemUsers) {
      await connection.execute(
        'INSERT IGNORE INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
        [user.username, user.email, passwordHash, 'farmaceutico', true]
      );
    }
    console.log(`✓ ${chemUsers.length} usuarios químicos farmacéuticos creados (password: quimico123)`);

    // ============================================================================
    // 4. Insertar doctores con áreas y especialidades
    // ============================================================================
    const doctors = [
      // Urgencias (area_id = 1)
      { name: 'Dr. Juan Carlos Pérez', license: 'CM-001234', specialty: 'Medicina de Emergencias', area_id: 1, email: 'juan.perez@hospital.com', phone: '987654101' },
      { name: 'Dra. María Fernanda Torres', license: 'CM-002345', specialty: 'Medicina de Emergencias', area_id: 1, email: 'maria.torres@hospital.com', phone: '987654102' },
      // Cirugía (area_id = 2)
      { name: 'Dr. Luis Alberto Ramírez', license: 'CM-003456', specialty: 'Cirugía General', area_id: 2, email: 'luis.ramirez@hospital.com', phone: '987654103' },
      { name: 'Dra. Carmen Rosa Vásquez', license: 'CM-004567', specialty: 'Cirugía General', area_id: 2, email: 'carmen.vasquez@hospital.com', phone: '987654104' },
      // Pediatría (area_id = 3)
      { name: 'Dra. Patricia Elena Morales', license: 'CM-005678', specialty: 'Pediatría', area_id: 3, email: 'patricia.morales@hospital.com', phone: '987654105' },
      { name: 'Dr. Fernando José Castro', license: 'CM-006789', specialty: 'Pediatría', area_id: 3, email: 'fernando.castro@hospital.com', phone: '987654106' },
      // Maternidad (area_id = 4)
      { name: 'Dra. Rosa María Jiménez', license: 'CM-007890', specialty: 'Ginecología y Obstetricia', area_id: 4, email: 'rosa.jimenez@hospital.com', phone: '987654107' },
      { name: 'Dr. Miguel Ángel Herrera', license: 'CM-008901', specialty: 'Ginecología y Obstetricia', area_id: 4, email: 'miguel.herrera@hospital.com', phone: '987654108' },
      // Medicina General (sin área)
      { name: 'Dr. Jorge Luis Mendoza', license: 'CM-009012', specialty: 'Medicina General', area_id: null, email: 'jorge.mendoza@hospital.com', phone: '987654109' },
      { name: 'Dra. Silvia Beatriz Rojas', license: 'CM-010123', specialty: 'Medicina General', area_id: null, email: 'silvia.rojas@hospital.com', phone: '987654110' },
      { name: 'Dr. Ricardo Antonio Flores', license: 'CM-011234', specialty: 'Medicina General', area_id: null, email: 'ricardo.flores@hospital.com', phone: '987654111' },
      // Especialidades (sin área)
      { name: 'Dr. Eduardo Manuel Díaz', license: 'CM-012345', specialty: 'Cardiología', area_id: null, email: 'eduardo.diaz@hospital.com', phone: '987654112' },
      { name: 'Dra. Gabriela Isabel Ruiz', license: 'CM-013456', specialty: 'Cardiología', area_id: null, email: 'gabriela.ruiz@hospital.com', phone: '987654113' },
      { name: 'Dr. Andrés Felipe Vargas', license: 'CM-014567', specialty: 'Neurología', area_id: null, email: 'andres.vargas@hospital.com', phone: '987654114' },
      { name: 'Dr. Diego Armando Soto', license: 'CM-015678', specialty: 'Traumatología', area_id: null, email: 'diego.soto@hospital.com', phone: '987654115' }
    ];

    for (const doctor of doctors) {
      await connection.execute(
        'INSERT IGNORE INTO doctors (name, license_number, specialty, area_id, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
        [doctor.name, doctor.license, doctor.specialty, doctor.area_id, doctor.email, doctor.phone]
      );
    }
    console.log(`✓ ${doctors.length} doctores insertados`);

    // ============================================================================
    // 5. Insertar pacientes
    // ============================================================================
    const patients = [
      { name: 'Jose Mariano Guevara Cotrina', id_number: '72114106', dob: '1985-05-15', gender: 'M', phone: '987654321', email: 'jose.guevara@email.com', address: 'Av. Principal 123' },
      { name: 'María Elena Fernández', id_number: '12345678', dob: '1990-03-20', gender: 'F', phone: '987654322', email: 'maria.fernandez@email.com', address: 'Jr. Los Olivos 456' },
      { name: 'Carlos Alberto Mendoza', id_number: '23456789', dob: '1988-07-10', gender: 'M', phone: '987654323', email: 'carlos.mendoza@email.com', address: 'Av. Libertad 789' },
      { name: 'Ana Patricia López', id_number: '34567890', dob: '1992-11-25', gender: 'F', phone: '987654324', email: 'ana.lopez@email.com', address: 'Calle Real 321' },
      { name: 'Roberto José García', id_number: '45678901', dob: '1987-09-05', gender: 'M', phone: '987654325', email: 'roberto.garcia@email.com', address: 'Av. San Martín 654' },
      { name: 'Laura Beatriz Sánchez', id_number: '56789012', dob: '1995-01-30', gender: 'F', phone: '987654326', email: 'laura.sanchez@email.com', address: 'Jr. Unión 987' },
      { name: 'Miguel Ángel Torres', id_number: '67890123', dob: '1983-12-18', gender: 'M', phone: '987654327', email: 'miguel.torres@email.com', address: 'Av. Progreso 147' },
      { name: 'Carmen Rosa Vásquez', id_number: '78901234', dob: '1991-06-22', gender: 'F', phone: '987654328', email: 'carmen.vasquez@email.com', address: 'Calle Bolívar 258' },
      { name: 'Fernando José Castro', id_number: '89012345', dob: '1989-04-14', gender: 'M', phone: '987654329', email: 'fernando.castro@email.com', address: 'Av. América 369' },
      { name: 'Patricia Elena Morales', id_number: '90123456', dob: '1993-08-08', gender: 'F', phone: '987654330', email: 'patricia.morales@email.com', address: 'Jr. Independencia 741' },
      { name: 'Luis Alberto Ramírez', id_number: '01234567', dob: '1986-02-28', gender: 'M', phone: '987654331', email: 'luis.ramirez@email.com', address: 'Av. Central 852' },
      { name: 'Rosa María Jiménez', id_number: '11223344', dob: '1994-10-12', gender: 'F', phone: '987654332', email: 'rosa.jimenez@email.com', address: 'Calle Principal 963' },
      { name: 'Jorge Luis Mendoza', id_number: '22334455', dob: '1984-07-03', gender: 'M', phone: '987654333', email: 'jorge.mendoza@email.com', address: 'Av. Los Héroes 159' },
      { name: 'Silvia Beatriz Rojas', id_number: '33445566', dob: '1990-05-19', gender: 'F', phone: '987654334', email: 'silvia.rojas@email.com', address: 'Jr. La Paz 357' },
      { name: 'Ricardo Antonio Flores', id_number: '44556677', dob: '1987-11-07', gender: 'M', phone: '987654335', email: 'ricardo.flores@email.com', address: 'Av. La Victoria 468' }
    ];

    for (const patient of patients) {
      await connection.execute(
        'INSERT IGNORE INTO patients (name, id_number, date_of_birth, gender, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [patient.name, patient.id_number, patient.dob, patient.gender, patient.phone, patient.email, patient.address]
      );
    }
    console.log(`✓ ${patients.length} pacientes insertados`);

    // ============================================================================
    // 6. Asignar áreas a productos
    // ============================================================================
    const [products] = await connection.execute('SELECT id, name FROM products');
    
    let productsWithArea = 0;
    for (const product of products) {
      let areaId = null;
      
      // Lógica de asignación de áreas
      if (product.name.includes('Amoxicilina') || product.name.includes('Penicilina') || product.name.includes('Eritromicina')) {
        areaId = 1; // Urgencias
      } else if (product.name.includes('Suturas') || product.name.includes('Tijeras') || product.name.includes('Pinzas')) {
        areaId = 2; // Cirugía
      } else if (product.name.includes('Pediatría') || product.name.includes('Infantil')) {
        areaId = 3; // Pediatría
      } else if (product.name.includes('Maternidad') || product.name.includes('Obstetricia')) {
        areaId = 4; // Maternidad
      } else if (product.id % 10 === 0) {
        areaId = 5; // Farmacia (cada 10 productos)
      } else if (product.name.includes('Enfermería') || product.name.includes('Curación') || product.name.includes('Gasas')) {
        areaId = 6; // Enfermería
      } else if (product.id % 7 === 0) {
        areaId = null; // Algunos sin área (uso general)
      }
      
      if (areaId) {
        await connection.execute('UPDATE products SET area_id = ? WHERE id = ?', [areaId, product.id]);
        productsWithArea++;
      }
    }
    console.log(`✓ ${productsWithArea} productos asignados a áreas`);

    // ============================================================================
    // 7. Crear restricciones de especialidad por producto
    // ============================================================================
    const [allProducts] = await connection.execute('SELECT id, name FROM products');
    
    let restrictionsCreated = 0;
    
    // Productos cardiovasculares solo para cardiólogos
    const cardiovascularProducts = allProducts.filter(p => 
      p.name.includes('Enalapril') || p.name.includes('Amlodipino') || 
      p.name.includes('Metoprolol') || p.name.includes('Warfarina') || 
      p.name.includes('Aspirina')
    );
    
    for (const product of cardiovascularProducts.slice(0, 20)) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id) VALUES (?, ?, ?)',
          [product.id, 'Cardiología', null]
        );
        restrictionsCreated++;
      } catch (e) {
        // Ignorar errores de duplicados
      }
    }
    
    // Productos pediátricos solo para pediatras
    const pediatricProducts = allProducts.filter(p => 
      p.name.includes('Pediatría') || p.name.includes('Infantil')
    );
    
    for (const product of pediatricProducts.slice(0, 15)) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id) VALUES (?, ?, ?)',
          [product.id, 'Pediatría', null]
        );
        restrictionsCreated++;
      } catch (e) {}
    }
    
    // Productos de cirugía solo para cirujanos
    const surgeryProducts = allProducts.filter(p => 
      p.name.includes('Suturas') || p.name.includes('Tijeras') || 
      p.name.includes('Pinzas') || p.name.includes('Quirúrgico')
    );
    
    for (const product of surgeryProducts.slice(0, 10)) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id) VALUES (?, ?, ?)',
          [product.id, 'Cirugía General', 2]
        );
        restrictionsCreated++;
      } catch (e) {}
    }
    
    // Productos de urgencias
    const emergencyProducts = allProducts.filter((p, idx) => 
      p.name.includes('Urgencia') || p.name.includes('Emergencia') || idx % 7 === 0
    );
    
    for (const product of emergencyProducts.slice(0, 15)) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id) VALUES (?, ?, ?)',
          [product.id, 'Medicina de Emergencias', 1]
        );
        restrictionsCreated++;
      } catch (e) {}
    }
    
    // Productos de ginecología
    const gynecologyProducts = allProducts.filter(p => 
      p.name.includes('Ginecología') || p.name.includes('Obstetricia') || p.name.includes('Maternidad')
    );
    
    for (const product of gynecologyProducts.slice(0, 8)) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO product_specialty_restrictions (product_id, specialty, area_id) VALUES (?, ?, ?)',
          [product.id, 'Ginecología y Obstetricia', 4]
        );
        restrictionsCreated++;
      } catch (e) {}
    }
    
    console.log(`✓ ${restrictionsCreated} restricciones de especialidad creadas`);

    // ============================================================================
    // 8. Mostrar resumen
    // ============================================================================
    const [stats] = await connection.execute(`
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
      SELECT 'Usuarios Químicos', COUNT(*) FROM users WHERE role = 'farmaceutico'
    `);

    console.log('\n📊 Resumen de datos insertados:');
    stats.forEach(stat => {
      console.log(`  ${stat.tabla}: ${stat.total}`);
    });

    console.log('\n✅ Datos poblados exitosamente');
    console.log('\n🔑 Credenciales de acceso:');
    console.log('  Usuario: quimico1 | Password: quimico123');
    console.log('  Usuario: quimico2 | Password: quimico123');
    console.log('  Usuario: quimico3 | Password: quimico123');

  } catch (error) {
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Conexión cerrada');
    }
  }
}

// Ejecutar el script
if (require.main === module) {
  populateData()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error al ejecutar el script:', error);
      process.exit(1);
    });
}

module.exports = { populateData };

