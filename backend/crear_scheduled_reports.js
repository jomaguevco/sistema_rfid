// Script para crear las tablas scheduled_reports
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
};

async function createTables() {
  let connection;
  try {
    console.log('🔍 Conectando a la base de datos...');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}\n`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Conexión establecida\n');
    
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../database/create_scheduled_reports.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    
    // Dividir en statements
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        try {
          await connection.execute(trimmed);
          if (trimmed.includes('scheduled_reports')) {
            console.log('✓ Tabla scheduled_reports creada');
          } else if (trimmed.includes('scheduled_report_executions')) {
            console.log('✓ Tabla scheduled_report_executions creada');
          }
        } catch (error) {
          if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ Tablas creadas correctamente');
    console.log('💡 Reinicia el servidor para que los cambios surtan efecto');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('💡 Las tablas ya existen');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createTables();

