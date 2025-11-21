/**
 * Script para normalizar todos los códigos RFID a formato de 7 números
 * 
 * Este script:
 * 1. Normaliza todos los RFID en la tabla products
 * 2. Normaliza todos los RFID en la tabla product_batches
 * 3. Actualiza los registros en la base de datos
 * 
 * Uso: node backend/scripts/normalizeRfidCodes.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();
const { normalizeRfidCode } = require('../utils/rfidNormalizer');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
  database: process.env.DB_NAME || 'rfid_stock_db',
  charset: 'utf8mb4'
};

async function normalizeRfidCodes() {
  let connection;
  try {
    console.log('🔧 Iniciando normalización de códigos RFID...\n');
    
    connection = await mysql.createConnection(dbConfig);
    await connection.query(`USE \`${dbConfig.database}\``);
    
    // 1. Normalizar RFID en tabla products
    console.log('1. Normalizando RFID en tabla products...');
    const [products] = await connection.execute(
      'SELECT id, rfid_uid FROM products WHERE rfid_uid IS NOT NULL AND rfid_uid != ""'
    );
    
    let productsUpdated = 0;
    for (const product of products) {
      const normalized = normalizeRfidCode(product.rfid_uid);
      if (normalized && normalized !== product.rfid_uid) {
        // Verificar que no exista otro producto con el mismo RFID normalizado
        const [existing] = await connection.execute(
          'SELECT id FROM products WHERE rfid_uid = ? AND id != ?',
          [normalized, product.id]
        );
        
        if (existing.length === 0) {
          await connection.execute(
            'UPDATE products SET rfid_uid = ? WHERE id = ?',
            [normalized, product.id]
          );
          console.log(`   ✓ Producto ${product.id}: "${product.rfid_uid}" → "${normalized}"`);
          productsUpdated++;
        } else {
          console.log(`   ✗ Producto ${product.id}: No se puede normalizar, conflicto con producto ${existing[0].id}`);
        }
      }
    }
    console.log(`   ✅ ${productsUpdated} productos actualizados\n`);
    
    // 2. Normalizar RFID en tabla product_batches
    console.log('2. Normalizando RFID en tabla product_batches...');
    const [batches] = await connection.execute(
      'SELECT id, rfid_uid FROM product_batches WHERE rfid_uid IS NOT NULL AND rfid_uid != ""'
    );
    
    let batchesUpdated = 0;
    for (const batch of batches) {
      const normalized = normalizeRfidCode(batch.rfid_uid);
      if (normalized && normalized !== batch.rfid_uid) {
        // Verificar que no exista otro lote con el mismo RFID normalizado
        const [existing] = await connection.execute(
          'SELECT id FROM product_batches WHERE rfid_uid = ? AND id != ?',
          [normalized, batch.id]
        );
        
        if (existing.length === 0) {
          await connection.execute(
            'UPDATE product_batches SET rfid_uid = ? WHERE id = ?',
            [normalized, batch.id]
          );
          console.log(`   ✓ Lote ${batch.id}: "${batch.rfid_uid}" → "${normalized}"`);
          batchesUpdated++;
        } else {
          console.log(`   ✗ Lote ${batch.id}: No se puede normalizar, conflicto con lote ${existing[0].id}`);
        }
      }
    }
    console.log(`   ✅ ${batchesUpdated} lotes actualizados\n`);
    
    // 3. Resumen final
    const [productsCount] = await connection.execute(
      'SELECT COUNT(*) as total FROM products WHERE rfid_uid IS NOT NULL AND rfid_uid != ""'
    );
    const [batchesCount] = await connection.execute(
      'SELECT COUNT(*) as total FROM product_batches WHERE rfid_uid IS NOT NULL AND rfid_uid != ""'
    );
    
    console.log('✅ Normalización completada\n');
    console.log('📊 Resumen:');
    console.log(`   - Productos con RFID: ${productsCount[0].total}`);
    console.log(`   - Lotes con RFID: ${batchesCount[0].total}`);
    console.log(`   - Productos normalizados: ${productsUpdated}`);
    console.log(`   - Lotes normalizados: ${batchesUpdated}\n`);
    
  } catch (error) {
    console.error('✗ Error al normalizar códigos RFID:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  normalizeRfidCodes()
    .then(() => {
      console.log('✅ Script ejecutado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { normalizeRfidCodes };

