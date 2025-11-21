/**
 * Script COMPLETO para crear todas las tablas faltantes y poblar TODAS las tablas
 * Incluye: doctores, pacientes, químicos farmacéuticos, recetas, permisos, etc.
 */

const db = require('../database_medical');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Función auxiliar para generar código aleatorio
function generateRandomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Función para generar fecha futura aleatoria
function generateFutureDate(minMonths = 6, maxMonths = 24) {
  const now = new Date();
  const months = minMonths + Math.floor(Math.random() * (maxMonths - minMonths));
  const futureDate = new Date(now);
  futureDate.setMonth(futureDate.getMonth() + months);
  return futureDate.toISOString().split('T')[0];
}

// Función para ejecutar archivo SQL
async function executeSqlFile(connection, filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
        } catch (e) {
          // Ignorar errores de tablas/columnas que ya existen
          if (!e.message.includes('already exists') && !e.message.includes('Duplicate column')) {
            console.log(`  ⚠️  Advertencia: ${e.message.substring(0, 100)}`);
          }
        }
      }
    }
    return true;
  } catch (error) {
    console.error(`  ✗ Error ejecutando ${filePath}:`, error.message);
    return false;
  }
}

async function completeDatabaseSetup() {
  let connection;
  
  try {
    // Intentar usar el pool primero, si falla usar conexión directa
    try {
      connection = await db.pool.getConnection();
      console.log('✓ Conectado usando pool de conexiones');
    } catch (poolError) {
      console.log('⚠ Pool no disponible, usando conexión directa...');
      try {
        connection = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
          database: process.env.DB_NAME || 'rfid_stock_db',
          multipleStatements: true
        });
        console.log('✓ Conectado a la base de datos');
      } catch (connError) {
        console.error('\n✗ ERROR: No se pudo conectar a la base de datos MySQL');
        throw connError;
      }
    }

    // ============================================================================
    // PASO 1: Crear tablas faltantes
    // ============================================================================
    console.log('\n📋 PASO 1: Creando tablas faltantes...');
    
    const sqlFiles = [
      'database/schema_doctors_patients.sql',
      'database/schema_prescriptions.sql',
      'database/schema_auth.sql'
    ];
    
    for (const sqlFile of sqlFiles) {
      const filePath = path.join(process.cwd(), sqlFile);
      if (fs.existsSync(filePath)) {
        console.log(`  Ejecutando ${sqlFile}...`);
        await executeSqlFile(connection, filePath);
        console.log(`  ✓ ${sqlFile} ejecutado`);
      } else {
        console.log(`  ⚠️  ${sqlFile} no encontrado, saltando...`);
      }
    }

    // Crear tabla de químicos farmacéuticos si no existe
    console.log('  Creando tabla pharmacists...');
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
    console.log('  ✓ Tabla pharmacists creada/verificada');

    // ============================================================================
    // PASO 2: Poblar DOCTORES
    // ============================================================================
    console.log('\n👨‍⚕️ PASO 2: Poblando doctores...');
    
    const [doctorCount] = await connection.execute('SELECT COUNT(*) as count FROM doctors');
    const currentDoctorCount = doctorCount[0].count;
    
    if (currentDoctorCount < 30) {
      const [areas] = await connection.execute('SELECT id, name FROM areas');
      const areaMap = {};
      areas.forEach(a => { areaMap[a.name] = a.id; });
      
      const doctors = [
        // Urgencias
        { name: 'Dr. Juan Carlos Pérez', license: 'CM-001234', specialty: 'Medicina de Emergencias', area: 'Urgencias', email: 'juan.perez@hospital.com', phone: '987654101' },
        { name: 'Dra. María Fernanda Torres', license: 'CM-002345', specialty: 'Medicina de Emergencias', area: 'Urgencias', email: 'maria.torres@hospital.com', phone: '987654102' },
        { name: 'Dr. Carlos Alberto Ramírez', license: 'CM-003456', specialty: 'Medicina de Emergencias', area: 'Urgencias', email: 'carlos.ramirez@hospital.com', phone: '987654103' },
        // Cirugía
        { name: 'Dr. Luis Alberto Ramírez', license: 'CM-004567', specialty: 'Cirugía General', area: 'Cirugía', email: 'luis.ramirez@hospital.com', phone: '987654104' },
        { name: 'Dra. Carmen Rosa Vásquez', license: 'CM-005678', specialty: 'Cirugía General', area: 'Cirugía', email: 'carmen.vasquez@hospital.com', phone: '987654105' },
        { name: 'Dr. Roberto José García', license: 'CM-006789', specialty: 'Cirugía General', area: 'Cirugía', email: 'roberto.garcia@hospital.com', phone: '987654106' },
        // Pediatría
        { name: 'Dra. Patricia Elena Morales', license: 'CM-007890', specialty: 'Pediatría', area: 'Pediatría', email: 'patricia.morales@hospital.com', phone: '987654107' },
        { name: 'Dr. Fernando José Castro', license: 'CM-008901', specialty: 'Pediatría', area: 'Pediatría', email: 'fernando.castro@hospital.com', phone: '987654108' },
        { name: 'Dra. Laura Beatriz Sánchez', license: 'CM-009012', specialty: 'Pediatría', area: 'Pediatría', email: 'laura.sanchez@hospital.com', phone: '987654109' },
        // Maternidad
        { name: 'Dra. Rosa María Jiménez', license: 'CM-010123', specialty: 'Ginecología y Obstetricia', area: 'Maternidad', email: 'rosa.jimenez@hospital.com', phone: '987654110' },
        { name: 'Dr. Miguel Ángel Herrera', license: 'CM-011234', specialty: 'Ginecología y Obstetricia', area: 'Maternidad', email: 'miguel.herrera@hospital.com', phone: '987654111' },
        { name: 'Dra. Ana Patricia López', license: 'CM-012345', specialty: 'Ginecología y Obstetricia', area: 'Maternidad', email: 'ana.lopez@hospital.com', phone: '987654112' },
        // Medicina General
        { name: 'Dr. Jorge Luis Mendoza', license: 'CM-013456', specialty: 'Medicina General', area: null, email: 'jorge.mendoza@hospital.com', phone: '987654113' },
        { name: 'Dra. Silvia Beatriz Rojas', license: 'CM-014567', specialty: 'Medicina General', area: null, email: 'silvia.rojas@hospital.com', phone: '987654114' },
        { name: 'Dr. Ricardo Antonio Flores', license: 'CM-015678', specialty: 'Medicina General', area: null, email: 'ricardo.flores@hospital.com', phone: '987654115' },
        // Especialidades
        { name: 'Dr. Eduardo Manuel Díaz', license: 'CM-016789', specialty: 'Cardiología', area: null, email: 'eduardo.diaz@hospital.com', phone: '987654116' },
        { name: 'Dra. Gabriela Isabel Ruiz', license: 'CM-017890', specialty: 'Cardiología', area: null, email: 'gabriela.ruiz@hospital.com', phone: '987654117' },
        { name: 'Dr. Andrés Felipe Vargas', license: 'CM-018901', specialty: 'Neurología', area: null, email: 'andres.vargas@hospital.com', phone: '987654118' },
        { name: 'Dr. Diego Armando Soto', license: 'CM-019012', specialty: 'Traumatología', area: null, email: 'diego.soto@hospital.com', phone: '987654119' },
        { name: 'Dra. Claudia Elena Martínez', license: 'CM-020123', specialty: 'Dermatología', area: null, email: 'claudia.martinez@hospital.com', phone: '987654120' },
        { name: 'Dr. José Luis Fernández', license: 'CM-021234', specialty: 'Oncología', area: null, email: 'jose.fernandez@hospital.com', phone: '987654121' },
        { name: 'Dra. María José González', license: 'CM-022345', specialty: 'Endocrinología', area: null, email: 'maria.gonzalez@hospital.com', phone: '987654122' },
        { name: 'Dr. Pedro Antonio Silva', license: 'CM-023456', specialty: 'Gastroenterología', area: null, email: 'pedro.silva@hospital.com', phone: '987654123' },
        { name: 'Dra. Lucía Beatriz Moreno', license: 'CM-024567', specialty: 'Nefrología', area: null, email: 'lucia.moreno@hospital.com', phone: '987654124' },
        { name: 'Dr. Francisco Javier Torres', license: 'CM-025678', specialty: 'Neumología', area: null, email: 'francisco.torres@hospital.com', phone: '987654125' },
        { name: 'Dra. Isabel Cristina Ramírez', license: 'CM-026789', specialty: 'Reumatología', area: null, email: 'isabel.ramirez@hospital.com', phone: '987654126' },
        { name: 'Dr. Manuel Alejandro Cruz', license: 'CM-027890', specialty: 'Urología', area: null, email: 'manuel.cruz@hospital.com', phone: '987654127' },
        { name: 'Dra. Verónica Patricia Herrera', license: 'CM-028901', specialty: 'Oftalmología', area: null, email: 'veronica.herrera@hospital.com', phone: '987654128' },
        { name: 'Dr. Sergio Roberto Méndez', license: 'CM-029012', specialty: 'Otorrinolaringología', area: null, email: 'sergio.mendez@hospital.com', phone: '987654129' },
        { name: 'Dra. Natalia Elena Vargas', license: 'CM-030123', specialty: 'Psiquiatría', area: null, email: 'natalia.vargas@hospital.com', phone: '987654130' }
      ];
      
      let inserted = 0;
      for (const doctor of doctors.slice(currentDoctorCount)) {
        try {
          const areaId = doctor.area ? areaMap[doctor.area] : null;
          await connection.execute(
            'INSERT IGNORE INTO doctors (name, license_number, specialty, area_id, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [doctor.name, doctor.license, doctor.specialty, areaId, doctor.email, doctor.phone]
          );
          inserted++;
        } catch (e) {
          // Ignorar duplicados
        }
      }
      console.log(`✅ ${inserted} doctores insertados`);
    } else {
      console.log(`✅ Doctores ya tienen datos (${currentDoctorCount} registros)`);
    }

    // ============================================================================
    // PASO 3: Poblar PACIENTES
    // ============================================================================
    console.log('\n👥 PASO 3: Poblando pacientes...');
    
    const [patientCount] = await connection.execute('SELECT COUNT(*) as count FROM patients');
    const currentPatientCount = patientCount[0].count;
    
    if (currentPatientCount < 50) {
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
        { name: 'Ricardo Antonio Flores', id_number: '44556677', dob: '1987-11-07', gender: 'M', phone: '987654335', email: 'ricardo.flores@email.com', address: 'Av. La Victoria 468' },
        { name: 'Eduardo Manuel Díaz', id_number: '55667788', dob: '1992-03-15', gender: 'M', phone: '987654336', email: 'eduardo.diaz@email.com', address: 'Av. Los Incas 123' },
        { name: 'Gabriela Isabel Ruiz', id_number: '66778899', dob: '1988-09-22', gender: 'F', phone: '987654337', email: 'gabriela.ruiz@email.com', address: 'Jr. San Juan 456' },
        { name: 'Andrés Felipe Vargas', id_number: '77889900', dob: '1985-12-08', gender: 'M', phone: '987654338', email: 'andres.vargas@email.com', address: 'Av. Grau 789' },
        { name: 'Diego Armando Soto', id_number: '88990011', dob: '1991-06-25', gender: 'M', phone: '987654339', email: 'diego.soto@email.com', address: 'Calle Lima 321' },
        { name: 'Claudia Elena Martínez', id_number: '99001122', dob: '1989-04-11', gender: 'F', phone: '987654340', email: 'claudia.martinez@email.com', address: 'Av. Tacna 654' },
        { name: 'José Luis Fernández', id_number: '10111213', dob: '1986-08-30', gender: 'M', phone: '987654341', email: 'jose.fernandez@email.com', address: 'Jr. Ayacucho 987' },
        { name: 'María José González', id_number: '20212223', dob: '1993-02-14', gender: 'F', phone: '987654342', email: 'maria.gonzalez@email.com', address: 'Av. Bolognesi 147' },
        { name: 'Pedro Antonio Silva', id_number: '30313233', dob: '1987-10-05', gender: 'M', phone: '987654343', email: 'pedro.silva@email.com', address: 'Calle Sucre 258' },
        { name: 'Lucía Beatriz Moreno', id_number: '40414243', dob: '1990-07-18', gender: 'F', phone: '987654344', email: 'lucia.moreno@email.com', address: 'Av. Arequipa 369' },
        { name: 'Francisco Javier Torres', id_number: '50515253', dob: '1984-11-27', gender: 'M', phone: '987654345', email: 'francisco.torres@email.com', address: 'Jr. Cusco 741' },
        { name: 'Isabel Cristina Ramírez', id_number: '60616263', dob: '1992-01-09', gender: 'F', phone: '987654346', email: 'isabel.ramirez@email.com', address: 'Av. Puno 852' },
        { name: 'Manuel Alejandro Cruz', id_number: '70717273', dob: '1988-05-23', gender: 'M', phone: '987654347', email: 'manuel.cruz@email.com', address: 'Calle Ica 963' },
        { name: 'Verónica Patricia Herrera', id_number: '80818283', dob: '1991-09-16', gender: 'F', phone: '987654348', email: 'veronica.herrera@email.com', address: 'Av. Trujillo 159' },
        { name: 'Sergio Roberto Méndez', id_number: '90919293', dob: '1985-03-04', gender: 'M', phone: '987654349', email: 'sergio.mendez@email.com', address: 'Jr. Piura 357' },
        { name: 'Natalia Elena Vargas', id_number: '01020304', dob: '1989-12-19', gender: 'F', phone: '987654350', email: 'natalia.vargas@email.com', address: 'Av. Chiclayo 468' },
        { name: 'Daniel Alejandro Ríos', id_number: '11121314', dob: '1994-06-07', gender: 'M', phone: '987654351', email: 'daniel.rios@email.com', address: 'Calle Huancayo 123' },
        { name: 'Sofía Alejandra Campos', id_number: '21222324', dob: '1990-08-21', gender: 'F', phone: '987654352', email: 'sofia.campos@email.com', address: 'Av. Iquitos 456' },
        { name: 'Alejandro Martín Peña', id_number: '31323334', dob: '1987-04-13', gender: 'M', phone: '987654353', email: 'alejandro.pena@email.com', address: 'Jr. Tarapoto 789' },
        { name: 'Valentina Esperanza Luna', id_number: '41424344', dob: '1993-10-28', gender: 'F', phone: '987654354', email: 'valentina.luna@email.com', address: 'Av. Cajamarca 321' },
        { name: 'Sebastián Ignacio Vega', id_number: '51525354', dob: '1986-02-02', gender: 'M', phone: '987654355', email: 'sebastian.vega@email.com', address: 'Calle Chimbote 654' },
        { name: 'Camila Estefanía Rojas', id_number: '61626364', dob: '1991-07-17', gender: 'F', phone: '987654356', email: 'camila.rojas@email.com', address: 'Av. Huánuco 987' },
        { name: 'Mateo Sebastián Paredes', id_number: '71727374', dob: '1988-11-29', gender: 'M', phone: '987654357', email: 'mateo.paredes@email.com', address: 'Jr. Tumbes 147' },
        { name: 'Isabella Fernanda Salas', id_number: '81828384', dob: '1992-05-12', gender: 'F', phone: '987654358', email: 'isabella.salas@email.com', address: 'Av. Pucallpa 258' },
        { name: 'Nicolás Andrés Quiroz', id_number: '91929394', dob: '1989-01-26', gender: 'M', phone: '987654359', email: 'nicolas.quiroz@email.com', address: 'Calle Moquegua 369' },
        { name: 'Martina Esperanza Delgado', id_number: '02030405', dob: '1995-09-03', gender: 'F', phone: '987654360', email: 'martina.delgado@email.com', address: 'Av. Tacna 741' }
      ];
      
      let inserted = 0;
      for (const patient of patients.slice(currentPatientCount)) {
        try {
          await connection.execute(
            'INSERT IGNORE INTO patients (name, id_number, date_of_birth, gender, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [patient.name, patient.id_number, patient.dob, patient.gender, patient.phone, patient.email, patient.address]
          );
          inserted++;
        } catch (e) {
          // Ignorar duplicados
        }
      }
      console.log(`✅ ${inserted} pacientes insertados`);
    } else {
      console.log(`✅ Pacientes ya tienen datos (${currentPatientCount} registros)`);
    }

    // ============================================================================
    // PASO 4: Poblar QUÍMICOS FARMACÉUTICOS
    // ============================================================================
    console.log('\n🧪 PASO 4: Poblando químicos farmacéuticos...');
    
    const [pharmacistCount] = await connection.execute('SELECT COUNT(*) as count FROM pharmacists');
    const currentPharmacistCount = pharmacistCount[0].count;
    
    if (currentPharmacistCount < 20) {
      const pharmacists = [
        { name: 'María Elena Rodríguez', id_number: '12345678', license: 'CQF-001234', email: 'maria.rodriguez@hospital.com', phone: '987654321' },
        { name: 'Carlos Alberto Méndez', id_number: '23456789', license: 'CQF-002345', email: 'carlos.mendez@hospital.com', phone: '987654322' },
        { name: 'Ana Patricia López', id_number: '34567890', license: 'CQF-003456', email: 'ana.lopez@hospital.com', phone: '987654323' },
        { name: 'Roberto José García', id_number: '45678901', license: 'CQF-004567', email: 'roberto.garcia@hospital.com', phone: '987654324' },
        { name: 'Laura Beatriz Sánchez', id_number: '56789012', license: 'CQF-005678', email: 'laura.sanchez@hospital.com', phone: '987654325' },
        { name: 'Miguel Ángel Torres', id_number: '67890123', license: 'CQF-006789', email: 'miguel.torres@hospital.com', phone: '987654326' },
        { name: 'Carmen Rosa Vásquez', id_number: '78901234', license: 'CQF-007890', email: 'carmen.vasquez@hospital.com', phone: '987654327' },
        { name: 'Fernando José Castro', id_number: '89012345', license: 'CQF-008901', email: 'fernando.castro@hospital.com', phone: '987654328' },
        { name: 'Patricia Elena Morales', id_number: '90123456', license: 'CQF-009012', email: 'patricia.morales@hospital.com', phone: '987654329' },
        { name: 'Luis Alberto Ramírez', id_number: '01234567', license: 'CQF-010123', email: 'luis.ramirez@hospital.com', phone: '987654330' },
        { name: 'Rosa María Jiménez', id_number: '11223344', license: 'CQF-011234', email: 'rosa.jimenez@hospital.com', phone: '987654331' },
        { name: 'Jorge Luis Mendoza', id_number: '22334455', license: 'CQF-012345', email: 'jorge.mendoza@hospital.com', phone: '987654332' },
        { name: 'Silvia Beatriz Rojas', id_number: '33445566', license: 'CQF-013456', email: 'silvia.rojas@hospital.com', phone: '987654333' },
        { name: 'Ricardo Antonio Flores', id_number: '44556677', license: 'CQF-014567', email: 'ricardo.flores@hospital.com', phone: '987654334' },
        { name: 'Eduardo Manuel Díaz', id_number: '55667788', license: 'CQF-015678', email: 'eduardo.diaz@hospital.com', phone: '987654335' },
        { name: 'Gabriela Isabel Ruiz', id_number: '66778899', license: 'CQF-016789', email: 'gabriela.ruiz@hospital.com', phone: '987654336' },
        { name: 'Andrés Felipe Vargas', id_number: '77889900', license: 'CQF-017890', email: 'andres.vargas@hospital.com', phone: '987654337' },
        { name: 'Diego Armando Soto', id_number: '88990011', license: 'CQF-018901', email: 'diego.soto@hospital.com', phone: '987654338' },
        { name: 'Claudia Elena Martínez', id_number: '99001122', license: 'CQF-019012', email: 'claudia.martinez@hospital.com', phone: '987654339' },
        { name: 'José Luis Fernández', id_number: '10111213', license: 'CQF-020123', email: 'jose.fernandez@hospital.com', phone: '987654340' }
      ];
      
      let inserted = 0;
      for (const pharm of pharmacists.slice(currentPharmacistCount)) {
        try {
          await connection.execute(
            'INSERT IGNORE INTO pharmacists (name, id_number, license_number, email, phone) VALUES (?, ?, ?, ?, ?)',
            [pharm.name, pharm.id_number, pharm.license, pharm.email, pharm.phone]
          );
          inserted++;
        } catch (e) {
          // Ignorar duplicados
        }
      }
      console.log(`✅ ${inserted} químicos farmacéuticos insertados`);
    } else {
      console.log(`✅ Químicos farmacéuticos ya tienen datos (${currentPharmacistCount} registros)`);
    }

    // ============================================================================
    // PASO 5: Crear usuarios químicos farmacéuticos
    // ============================================================================
    console.log('\n👤 PASO 5: Creando usuarios químicos farmacéuticos...');
    
    const { hashPassword } = require('../utils/password');
    const passwordHash = await hashPassword('quimico123');
    
    const chemUsers = [
      { username: 'quimico1', email: 'maria.rodriguez@hospital.com' },
      { username: 'quimico2', email: 'carlos.mendez@hospital.com' },
      { username: 'quimico3', email: 'ana.lopez@hospital.com' },
      { username: 'quimico4', email: 'roberto.garcia@hospital.com' },
      { username: 'quimico5', email: 'laura.sanchez@hospital.com' }
    ];
    
    let usersCreated = 0;
    for (const user of chemUsers) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
          [user.username, user.email, passwordHash, 'farmaceutico', true]
        );
        usersCreated++;
      } catch (e) {
        // Ignorar duplicados
      }
    }
    console.log(`✅ ${usersCreated} usuarios químicos farmacéuticos creados (password: quimico123)`);

    // ============================================================================
    // PASO 6: Poblar RECETAS (si la tabla existe)
    // ============================================================================
    console.log('\n💊 PASO 6: Poblando recetas médicas...');
    
    const [prescriptionTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'prescriptions'
    `);
    
    if (prescriptionTable[0].count > 0) {
      const [prescriptionCount] = await connection.execute('SELECT COUNT(*) as count FROM prescriptions');
      const currentPrescriptionCount = prescriptionCount[0].count;
      
      if (currentPrescriptionCount < 50) {
        const [doctors] = await connection.execute('SELECT id, name, license_number FROM doctors LIMIT 20');
        const [patients] = await connection.execute('SELECT id, name, id_number FROM patients LIMIT 20');
        const [users] = await connection.execute('SELECT id FROM users LIMIT 3');
        const userId = users.length > 0 ? users[0].id : null;
        
        if (doctors.length > 0 && patients.length > 0) {
          const statuses = ['pending', 'partial', 'fulfilled'];
          const today = new Date();
          const prescriptionsToCreate = 50 - currentPrescriptionCount;
          
          for (let i = 0; i < prescriptionsToCreate; i++) {
            const doctor = doctors[Math.floor(Math.random() * doctors.length)];
            const patient = patients[Math.floor(Math.random() * patients.length)];
            const prescriptionDate = new Date(today);
            prescriptionDate.setDate(prescriptionDate.getDate() - Math.floor(Math.random() * 60));
            const prescriptionCode = `REC-${new Date().getFullYear()}-${String(currentPrescriptionCount + i + 1).padStart(4, '0')}`;
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            
            try {
              const [result] = await connection.execute(
                `INSERT INTO prescriptions 
                 (prescription_code, patient_name, patient_id, patient_id_number, doctor_name, doctor_license, doctor_id, prescription_date, status, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  prescriptionCode,
                  patient.name,
                  patient.id,
                  patient.id_number,
                  doctor.name,
                  doctor.license_number,
                  doctor.id,
                  prescriptionDate.toISOString().split('T')[0],
                  status,
                  userId
                ]
              );
              
              // Crear items para esta receta
              const [prescriptionProducts] = await connection.execute('SELECT id FROM products WHERE product_type = "medicamento" ORDER BY RAND() LIMIT ' + (1 + Math.floor(Math.random() * 3)));
              
              for (const product of prescriptionProducts) {
                const quantityRequired = 1 + Math.floor(Math.random() * 3);
                const instructions = ['1 tableta cada 8 horas', '1 tableta cada 12 horas', '1 tableta cada 6 horas', '2 tabletas al día', '1 tableta antes de las comidas'][Math.floor(Math.random() * 5)];
                const quantityDispensed = status === 'fulfilled' ? quantityRequired : (status === 'partial' ? Math.floor(quantityRequired / 2) : 0);
                
                await connection.execute(
                  `INSERT INTO prescription_items 
                   (prescription_id, product_id, quantity_required, quantity_dispensed, instructions) 
                   VALUES (?, ?, ?, ?, ?)`,
                  [result.insertId, product.id, quantityRequired, quantityDispensed, instructions]
                );
              }
            } catch (e) {
              // Ignorar errores
            }
          }
          console.log(`✅ ${prescriptionsToCreate} recetas médicas con items insertadas`);
        }
      } else {
        console.log(`✅ Recetas ya tienen datos (${currentPrescriptionCount} registros)`);
      }
    } else {
      console.log('⚠️  Tabla prescriptions no existe, saltando...');
    }

    // ============================================================================
    // RESUMEN FINAL
    // ============================================================================
    console.log('\n✅ Configuración completa de base de datos finalizada');
    console.log('\n📊 Resumen final:');
    
    const stats = [];
    
    try {
      const [doctorsCount] = await connection.execute('SELECT COUNT(*) as total FROM doctors');
      stats.push({ tabla: 'Doctores', total: doctorsCount[0].total });
    } catch (e) {}
    
    try {
      const [patientsCount] = await connection.execute('SELECT COUNT(*) as total FROM patients');
      stats.push({ tabla: 'Pacientes', total: patientsCount[0].total });
    } catch (e) {}
    
    try {
      const [pharmacistsCount] = await connection.execute('SELECT COUNT(*) as total FROM pharmacists');
      stats.push({ tabla: 'Químicos Farmacéuticos', total: pharmacistsCount[0].total });
    } catch (e) {}
    
    try {
      const [prescriptionsCount] = await connection.execute('SELECT COUNT(*) as total FROM prescriptions');
      stats.push({ tabla: 'Recetas', total: prescriptionsCount[0].total });
    } catch (e) {}
    
    try {
      const [prescriptionItemsCount] = await connection.execute('SELECT COUNT(*) as total FROM prescription_items');
      stats.push({ tabla: 'Items de Receta', total: prescriptionItemsCount[0].total });
    } catch (e) {}
    
    try {
      const [permissionsCount] = await connection.execute('SELECT COUNT(*) as total FROM permissions');
      stats.push({ tabla: 'Permisos', total: permissionsCount[0].total });
    } catch (e) {}
    
    try {
      const [rolePermCount] = await connection.execute('SELECT COUNT(*) as total FROM role_permissions');
      stats.push({ tabla: 'Permisos de Roles', total: rolePermCount[0].total });
    } catch (e) {}
    
    stats.forEach(stat => {
      console.log(`  ${stat.tabla}: ${stat.total}`);
    });

    console.log('\n🔑 Credenciales de acceso para químicos farmacéuticos:');
    console.log('  Usuario: quimico1 | Password: quimico123');
    console.log('  Usuario: quimico2 | Password: quimico123');
    console.log('  Usuario: quimico3 | Password: quimico123');
    console.log('  Usuario: quimico4 | Password: quimico123');
    console.log('  Usuario: quimico5 | Password: quimico123');

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    if (connection && connection.release) {
      connection.release();
    } else if (connection && connection.end) {
      await connection.end();
    }
    console.log('\n✓ Conexión cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  completeDatabaseSetup()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error al ejecutar el script:', error);
      process.exit(1);
    });
}

module.exports = { completeDatabaseSetup };

