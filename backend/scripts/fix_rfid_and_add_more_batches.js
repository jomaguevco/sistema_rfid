/**
 * Script para:
 * 1. Eliminar la restricción UNIQUE en rfid_uid de product_batches
 * 2. Agregar más lotes a productos existentes para tener ejemplos de múltiples lotes con el mismo RFID
 */

const mysql = require('mysql2/promise');
const { normalizeRfidCode } = require('../utils/rfidNormalizer');
require('dotenv').config();

async function fixRfidAndAddMoreBatches() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
      database: process.env.DB_NAME || 'rfid_stock_db',
      multipleStatements: true
    });

    console.log('✓ Conectado a la base de datos\n');

    // PASO 1: Eliminar la restricción UNIQUE en rfid_uid
    console.log('🔧 PASO 1: Eliminando restricción UNIQUE en rfid_uid...\n');
    
    try {
      // Intentar eliminar el índice UNIQUE
      await connection.execute('DROP INDEX IF EXISTS rfid_uid ON product_batches');
      console.log('  ✓ Índice UNIQUE eliminado (si existía)');
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('  ⚠️  El índice no existe, intentando eliminar por ALTER TABLE...');
        try {
          await connection.execute('ALTER TABLE product_batches DROP INDEX rfid_uid');
          console.log('  ✓ Índice UNIQUE eliminado');
        } catch (err2) {
          if (!err2.message.includes("Can't DROP") && !err2.message.includes("doesn't exist")) {
            console.log('  ⚠️  Error al eliminar índice:', err2.message);
          } else {
            console.log('  ✓ El índice ya no existe');
          }
        }
      }
    }

    // Crear índice sin restricción UNIQUE
    try {
      await connection.execute('CREATE INDEX idx_rfid_uid ON product_batches(rfid_uid)');
      console.log('  ✓ Índice no único creado');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('  ℹ️  El índice ya existe');
      } else {
        console.log('  ⚠️  Error al crear índice:', err.message);
      }
    }

    // PASO 2: Agregar más lotes a productos existentes
    console.log('\n📦 PASO 2: Agregando más lotes a productos existentes...\n');

    // Obtener productos que tienen RFID pero pocos lotes
    const [productsWithRfid] = await connection.execute(`
      SELECT 
        p.id,
        p.name,
        p.rfid_uid,
        COUNT(pb.id) as num_batches
      FROM products p
      LEFT JOIN product_batches pb ON pb.product_id = p.id
      WHERE p.rfid_uid IS NOT NULL 
        AND p.rfid_uid != ''
        AND p.rfid_uid != '-'
      GROUP BY p.id, p.name, p.rfid_uid
      HAVING COUNT(pb.id) < 3
      ORDER BY num_batches ASC, p.name
      LIMIT 30
    `);

    if (productsWithRfid.length === 0) {
      console.log('  ℹ️  No se encontraron productos con RFID que necesiten más lotes');
    } else {
      console.log(`  📋 Se encontraron ${productsWithRfid.length} productos para agregar lotes\n`);

      let batchesAdded = 0;
      let productsProcessed = 0;

      for (const product of productsWithRfid) {
        const productId = product.id;
        const productName = product.name;
        const rfidUid = normalizeRfidCode(product.rfid_uid) || product.rfid_uid;
        const numBatches = product.num_batches || 0;

        // Calcular cuántos lotes agregar (hasta tener 2-3 lotes)
        const batchesToAdd = Math.max(1, 3 - numBatches);
        
        for (let i = 0; i < batchesToAdd; i++) {
          try {
            // Generar número de lote único
            const lotNumber = `LOT-${new Date().getFullYear()}-${String(productId).padStart(3, '0')}-${String(numBatches + i + 1).padStart(3, '0')}`;
            
            // Generar fecha de vencimiento (6-36 meses en el futuro)
            const monthsToAdd = 6 + Math.floor(Math.random() * 30);
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + monthsToAdd);
            const expiryDateStr = expiryDate.toISOString().split('T')[0];

            // Generar cantidad (25-200 unidades)
            const quantity = 25 + Math.floor(Math.random() * 175);

            // Insertar lote
            await connection.execute(
              `INSERT INTO product_batches 
               (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
               VALUES (?, ?, ?, ?, ?, CURDATE(), NOW())`,
              [productId, lotNumber, expiryDateStr, quantity, rfidUid]
            );

            batchesAdded++;
          } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
              // Ya existe este lote, continuar
              continue;
            } else {
              console.log(`    ⚠️  Error al agregar lote para "${productName}":`, err.message);
            }
          }
        }

        productsProcessed++;
        console.log(`  ✓ ${productName} - ${batchesToAdd} lote(s) agregado(s) | RFID: ${rfidUid}`);
      }

      console.log(`\n  ✅ Proceso completado:`);
      console.log(`     - Productos procesados: ${productsProcessed}`);
      console.log(`     - Lotes agregados: ${batchesAdded}`);
    }

    // PASO 3: Verificar resultados
    console.log('\n📊 PASO 3: Verificando resultados...\n');

    const [summary] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT p.id) as total_productos,
        COUNT(pb.id) as total_lotes,
        COUNT(DISTINCT pb.rfid_uid) as rfids_unicos
      FROM products p
      LEFT JOIN product_batches pb ON pb.product_id = p.id
      WHERE p.rfid_uid IS NOT NULL AND p.rfid_uid != '' AND p.rfid_uid != '-'
    `);

    const [multipleBatches] = await connection.execute(`
      SELECT 
        p.name,
        p.rfid_uid,
        COUNT(pb.id) as num_lotes,
        SUM(pb.quantity) as stock_total
      FROM products p
      JOIN product_batches pb ON pb.product_id = p.id
      WHERE p.rfid_uid IS NOT NULL AND p.rfid_uid != '' AND p.rfid_uid != '-'
      GROUP BY p.id, p.name, p.rfid_uid
      HAVING COUNT(pb.id) > 1
      ORDER BY num_lotes DESC, p.name
      LIMIT 10
    `);

    console.log('📈 Resumen general:');
    console.log(`   - Productos con RFID: ${summary[0].total_productos}`);
    console.log(`   - Total de lotes: ${summary[0].total_lotes}`);
    console.log(`   - RFIDs únicos: ${summary[0].rfids_unicos}\n`);

    if (multipleBatches.length > 0) {
      console.log(`✅ Productos con múltiples lotes (${multipleBatches.length} primeros):`);
      multipleBatches.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name} | RFID: ${row.rfid_uid} | ${row.num_lotes} lotes | Stock: ${row.stock_total}`);
      });
    } else {
      console.log('⚠️  No se encontraron productos con múltiples lotes');
      console.log('   Esto puede indicar que aún existe la restricción UNIQUE');
    }

    console.log('\n✅ Script completado exitosamente');

  } catch (error) {
    console.error('✗ Error:', error);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Conexión cerrada');
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixRfidAndAddMoreBatches()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { fixRfidAndAddMoreBatches };

