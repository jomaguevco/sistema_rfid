/**
 * Script para aplicar los campos de formato institucional a la base de datos
 * Ejecutar: node backend/scripts/apply_prescription_format.js
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
  database: process.env.DB_NAME || 'rfid_stock_db',
  multipleStatements: true
};

async function applyPrescriptionFormat() {
  let connection;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexión exitosa');

    // ==================== TABLA DOCTORS ====================
    console.log('\n📋 Verificando tabla doctors...');
    
    // Verificar si existe la columna service_type
    const [doctorCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'doctors'
      AND COLUMN_NAME = 'service_type'
    `);

    if (doctorCols.length === 0) {
      console.log('  ➕ Agregando columna service_type a doctors...');
      await connection.execute(`
        ALTER TABLE doctors 
        ADD COLUMN service_type VARCHAR(100) DEFAULT 'Farmacia Consulta Externa'
      `);
      console.log('  ✅ Columna service_type agregada');
    } else {
      console.log('  ✓ Columna service_type ya existe');
    }

    // ==================== TABLA PRESCRIPTIONS ====================
    console.log('\n📋 Verificando tabla prescriptions...');
    
    const prescriptionColumns = [
      { name: 'specialty', type: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'service', type: "VARCHAR(100) DEFAULT 'Farmacia Consulta Externa'" },
      { name: 'attention_type', type: "VARCHAR(50) DEFAULT 'Consulta Externa'" },
      { name: 'receipt_number', type: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'patient_phone', type: 'VARCHAR(20) DEFAULT NULL' },
      { name: 'patient_id_number', type: 'VARCHAR(50) DEFAULT NULL' },
      { name: 'doctor_id', type: 'INT DEFAULT NULL' }
    ];

    for (const col of prescriptionColumns) {
      const [exists] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'prescriptions'
        AND COLUMN_NAME = ?
      `, [col.name]);

      if (exists.length === 0) {
        console.log(`  ➕ Agregando columna ${col.name}...`);
        await connection.execute(`ALTER TABLE prescriptions ADD COLUMN ${col.name} ${col.type}`);
        console.log(`  ✅ Columna ${col.name} agregada`);
      } else {
        console.log(`  ✓ Columna ${col.name} ya existe`);
      }
    }

    // Crear índice para receipt_number si no existe
    console.log('\n📋 Verificando índices...');
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM prescriptions WHERE Key_name = 'idx_prescriptions_receipt_number'
    `);
    
    if (indexes.length === 0) {
      console.log('  ➕ Creando índice idx_prescriptions_receipt_number...');
      await connection.execute(`
        CREATE INDEX idx_prescriptions_receipt_number ON prescriptions(receipt_number)
      `);
      console.log('  ✅ Índice creado');
    } else {
      console.log('  ✓ Índice idx_prescriptions_receipt_number ya existe');
    }

    // ==================== TABLA PRESCRIPTION_ITEMS ====================
    console.log('\n📋 Verificando tabla prescription_items...');
    
    const itemColumns = [
      { name: 'administration_route', type: "VARCHAR(50) DEFAULT 'Oral'" },
      { name: 'dosage', type: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'duration', type: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'item_code', type: 'VARCHAR(50) DEFAULT NULL' }
    ];

    for (const col of itemColumns) {
      const [exists] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'prescription_items'
        AND COLUMN_NAME = ?
      `, [col.name]);

      if (exists.length === 0) {
        console.log(`  ➕ Agregando columna ${col.name}...`);
        await connection.execute(`ALTER TABLE prescription_items ADD COLUMN ${col.name} ${col.type}`);
        console.log(`  ✅ Columna ${col.name} agregada`);
      } else {
        console.log(`  ✓ Columna ${col.name} ya existe`);
      }
    }

    // ==================== ACTUALIZAR RECETAS EXISTENTES ====================
    console.log('\n📋 Actualizando recetas existentes...');
    
    // Generar receipt_number para recetas que no lo tengan
    const [updated] = await connection.execute(`
      UPDATE prescriptions 
      SET receipt_number = CONCAT('ORD-', LPAD(id, 7, '0'))
      WHERE receipt_number IS NULL OR receipt_number = ''
    `);
    
    console.log(`  ✅ ${updated.affectedRows} recetas actualizadas con número de orden`);

    // ==================== VERIFICACIÓN FINAL ====================
    console.log('\n📊 Verificación final...');
    
    // Contar columnas en cada tabla
    const [prescCols] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescriptions'
    `);
    
    const [itemCols] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prescription_items'
    `);

    console.log(`  📋 Tabla prescriptions: ${prescCols[0].count} columnas`);
    console.log(`  📋 Tabla prescription_items: ${itemCols[0].count} columnas`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ ¡Formato institucional de recetas aplicado correctamente!');
    console.log('═'.repeat(60));
    console.log('\nCampos agregados:');
    console.log('  • doctors: service_type');
    console.log('  • prescriptions: specialty, service, attention_type, receipt_number, patient_phone, patient_id_number, doctor_id');
    console.log('  • prescription_items: administration_route, dosage, duration, item_code');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error al aplicar formato de recetas:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   → Verifica las credenciales de la base de datos');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   → Verifica que MySQL esté ejecutándose');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   → La base de datos no existe. Ejecuta primero el schema principal.');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

// Ejecutar
applyPrescriptionFormat();

