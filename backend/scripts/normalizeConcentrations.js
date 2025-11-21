/**
 * Script para normalizar todas las concentraciones agregando /5mL si no tienen volumen
 * 
 * Este script:
 * 1. Busca todas las concentraciones que no tienen volumen (/)
 * 2. Les agrega /5mL automáticamente
 * 3. Actualiza los registros en la base de datos
 * 
 * Uso: node backend/scripts/normalizeConcentrations.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();
const { formatConcentration } = require('../utils/rfidNormalizer');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
  database: process.env.DB_NAME || 'rfid_stock_db',
  charset: 'utf8mb4'
};

async function normalizeConcentrations() {
  let connection;
  try {
    console.log('🔧 Iniciando normalización de concentraciones...\n');
    
    connection = await mysql.createConnection(dbConfig);
    await connection.query(`USE \`${dbConfig.database}\``);
    
    // 1. Buscar todas las concentraciones que no tienen volumen
    console.log('1. Buscando concentraciones sin volumen...');
    const [products] = await connection.execute(
      `SELECT id, concentration FROM products 
       WHERE concentration IS NOT NULL 
       AND concentration != "" 
       AND concentration NOT LIKE "%/%"`
    );
    
    console.log(`   📦 Encontradas ${products.length} concentraciones para normalizar\n`);
    
    // 2. Normalizar concentraciones
    console.log('2. Normalizando concentraciones...');
    let updated = 0;
    for (const product of products) {
      const original = product.concentration;
      const normalized = formatConcentration(original);
      
      if (normalized && normalized !== original) {
        await connection.execute(
          'UPDATE products SET concentration = ? WHERE id = ?',
          [normalized, product.id]
        );
        console.log(`   ✓ Producto ${product.id}: "${original}" → "${normalized}"`);
        updated++;
      }
    }
    
    console.log(`   ✅ ${updated} concentraciones actualizadas\n`);
    
    // 3. Resumen final
    const [totalWithConcentration] = await connection.execute(
      'SELECT COUNT(*) as total FROM products WHERE concentration IS NOT NULL AND concentration != ""'
    );
    
    const [totalWithVolume] = await connection.execute(
      'SELECT COUNT(*) as total FROM products WHERE concentration LIKE "%/%"'
    );
    
    console.log('✅ Normalización completada\n');
    console.log('📊 Resumen:');
    console.log(`   - Productos con concentración: ${totalWithConcentration[0].total}`);
    console.log(`   - Productos con volumen: ${totalWithVolume[0].total}`);
    console.log(`   - Concentraciones normalizadas: ${updated}\n`);
    
  } catch (error) {
    console.error('✗ Error al normalizar concentraciones:', error);
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
  normalizeConcentrations()
    .then(() => {
      console.log('✅ Script ejecutado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { normalizeConcentrations };

