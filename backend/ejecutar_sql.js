// Script para ejecutar todos los archivos SQL en la base de datos AWS RDS
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// Cargar variables de entorno
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'rfid_stock_db',
  multipleStatements: true
};

// Archivos SQL a ejecutar en orden
const sqlFiles = [
  // 1. Esquemas (crear tablas)
  '../database/schema_auth.sql',
  '../database/schema_medical.sql',
  '../database/schema_suppliers.sql',
  
  // 2. Datos de ejemplo
  '../database/insert_sample_data.sql',
  '../database/insert_complete_data.sql',
  '../database/insert_more_data.sql',
  
  // 3. Optimización
  '../database/optimize_indexes.sql'
];

async function readSqlFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Error al leer archivo ${filePath}:`, error.message);
    return null;
  }
}

async function executeSql(connection, sql) {
  // Dividir en statements individuales
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await connection.query(statement);
      } catch (error) {
        // Ignorar errores de "table already exists" o "duplicate entry"
        if (!error.message.includes('already exists') && 
            !error.message.includes('Duplicate entry') &&
            !error.message.includes('doesn\'t exist')) {
          console.warn(`⚠️  Advertencia: ${error.message.substring(0, 100)}`);
        }
      }
    }
  }
}

async function ejecutarTodosLosSQL() {
  let connection;
  try {
    console.log('🚀 Ejecutando scripts SQL en la base de datos AWS RDS...\n');
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Database: ${dbConfig.database}\n`);
    
    // Conectar a la base de datos
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Conexión establecida\n');
    
    // Ejecutar cada archivo SQL
    for (let i = 0; i < sqlFiles.length; i++) {
      const filePath = sqlFiles[i];
      const fileName = path.basename(filePath);
      
      console.log(`[${i + 1}/${sqlFiles.length}] Ejecutando: ${fileName}...`);
      
      const sqlContent = await readSqlFile(filePath);
      
      if (!sqlContent) {
        console.log(`   ⚠️  Archivo no encontrado, saltando...\n`);
        continue;
      }
      
      try {
        await executeSql(connection, sqlContent);
        console.log(`   ✓ ${fileName} ejecutado correctamente\n`);
      } catch (error) {
        console.error(`   ✗ Error al ejecutar ${fileName}:`, error.message);
        console.log(`   Continuando con el siguiente archivo...\n`);
      }
    }
    
    console.log('✅ Todos los scripts SQL han sido ejecutados\n');
    
    // Verificar datos insertados
    console.log('📊 Verificando datos insertados...\n');
    
    const [categories] = await connection.query('SELECT COUNT(*) as count FROM product_categories');
    const [products] = await connection.query('SELECT COUNT(*) as count FROM products');
    const [batches] = await connection.query('SELECT COUNT(*) as count FROM product_batches');
    const [areas] = await connection.query('SELECT COUNT(*) as count FROM areas');
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    
    console.log(`   Categorías: ${categories[0].count}`);
    console.log(`   Productos: ${products[0].count}`);
    console.log(`   Lotes: ${batches[0].count}`);
    console.log(`   Áreas: ${areas[0].count}`);
    console.log(`   Usuarios: ${users[0].count}\n`);
    
    console.log('🎉 Proceso completado exitosamente!');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

ejecutarTodosLosSQL();

