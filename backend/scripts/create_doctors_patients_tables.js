/**
 * Script para crear las tablas de doctores y pacientes
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function createTables() {
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

    const sqlFile = path.join(__dirname, '../../database/schema_doctors_patients.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Ejecutar el script SQL
    await connection.query(sql);

    console.log('✅ Tablas creadas exitosamente');
    console.log('  - doctors');
    console.log('  - patients');
    console.log('  - product_specialty_restrictions');
    console.log('  - Columnas agregadas a products y prescriptions');

  } catch (error) {
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  createTables()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error al ejecutar el script:', error);
      process.exit(1);
    });
}

module.exports = { createTables };
