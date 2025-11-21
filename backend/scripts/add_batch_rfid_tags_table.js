const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function addBatchRfidTagsTable() {
  let connection;
  
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
      database: process.env.DB_NAME || 'rfid_stock_db'
    });

    console.log('🔧 Creando tabla batch_rfid_tags...\n');

    // Leer el script SQL
    const sqlPath = path.join(__dirname, '..', '..', 'database', 'add_batch_rfid_tags_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar el script
    await connection.query(sql);

    console.log('✅ Tabla batch_rfid_tags creada exitosamente\n');

    // Migrar datos existentes: copiar rfid_uid de product_batches a batch_rfid_tags
    console.log('🔄 Migrando RFID existentes a batch_rfid_tags...\n');
    
    const [batches] = await connection.execute(
      'SELECT id, rfid_uid FROM product_batches WHERE rfid_uid IS NOT NULL AND rfid_uid != ""'
    );

    let migrated = 0;
    for (const batch of batches) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO batch_rfid_tags (batch_id, rfid_uid) VALUES (?, ?)',
          [batch.id, batch.rfid_uid]
        );
        migrated++;
      } catch (error) {
        console.warn(`⚠️  No se pudo migrar RFID para lote ${batch.id}:`, error.message);
      }
    }

    console.log(`✅ ${migrated} RFID migrados a batch_rfid_tags\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
addBatchRfidTagsTable();

