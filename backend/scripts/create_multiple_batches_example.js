/**
 * Script para crear un ejemplo específico con múltiples lotes
 * que comparten el mismo código RFID, para demostrar la funcionalidad
 */

const mysql = require('mysql2/promise');
const { normalizeRfidCode, formatConcentration } = require('../utils/rfidNormalizer');
require('dotenv').config();

async function createMultipleBatchesExample() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'rfid_stock_db',
      multipleStatements: true
    });

    console.log('✓ Conectado a la base de datos');

    // Buscar o crear un producto de ejemplo
    const [existingProducts] = await connection.execute(
      'SELECT id, name FROM products WHERE name = "Paracetamol 500mg" OR name = "Amoxicilina 500mg" LIMIT 1'
    );

    let productId;
    let productName;
    let rfidCode = normalizeRfidCode('2090099'); // Un RFID específico para el ejemplo

    if (existingProducts.length > 0) {
      // Usar producto existente
      productId = existingProducts[0].id;
      productName = existingProducts[0].name;
      
      // Obtener el RFID del producto o usar el del ejemplo
      const [productData] = await connection.execute(
        'SELECT rfid_uid FROM products WHERE id = ?',
        [productId]
      );
      if (productData[0].rfid_uid) {
        rfidCode = normalizeRfidCode(productData[0].rfid_uid) || rfidCode;
      }
      
      console.log(`📦 Usando producto existente: ${productName} (ID: ${productId})`);
    } else {
      // Crear un producto nuevo de ejemplo
      const [categories] = await connection.execute(
        'SELECT id FROM product_categories WHERE name LIKE "%Analgésico%" OR name LIKE "%Antibiótico%" LIMIT 1'
      );
      const categoryId = categories.length > 0 ? categories[0].id : 1;

      const [result] = await connection.execute(
        `INSERT INTO products 
         (name, description, product_type, active_ingredient, concentration, presentation, 
          administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          'Ejemplo Multi-Lote',
          'Producto de ejemplo con múltiples lotes que comparten el mismo RFID',
          'medicamento',
          'Paracetamol',
          formatConcentration('500mg', 'medicamento'),
          'Tabletas',
          'Oral',
          categoryId,
          10,
          0,
          rfidCode
        ]
      );

      productId = result.insertId;
      productName = 'Ejemplo Multi-Lote';
      console.log(`✅ Producto creado: ${productName} (ID: ${productId})`);
    }

    // Verificar lotes existentes con este RFID
    const [existingBatches] = await connection.execute(
      'SELECT id, lot_number, quantity FROM product_batches WHERE product_id = ? AND rfid_uid = ?',
      [productId, rfidCode]
    );

    if (existingBatches.length >= 2) {
      console.log(`\n✅ Ya existen ${existingBatches.length} lotes con el RFID ${rfidCode}:`);
      existingBatches.forEach((batch, index) => {
        console.log(`   ${index + 1}. Lote: ${batch.lot_number} - Cantidad: ${batch.quantity}`);
      });
      console.log('\n💡 Puedes ver estos lotes en el modal de Stock haciendo clic en el botón "Stock"');
      return;
    }

    // Crear múltiples lotes con el mismo RFID
    console.log(`\n📦 Creando múltiples lotes con RFID: ${rfidCode}`);
    
    const today = new Date();
    const batches = [
      {
        lot_number: `LOT-${String(productId).padStart(6, '0')}-001`,
        expiry_date: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().split('T')[0],
        quantity: 50,
        entry_date: new Date(today.getFullYear(), today.getMonth() - 2, today.getDate()).toISOString().split('T')[0]
      },
      {
        lot_number: `LOT-${String(productId).padStart(6, '0')}-002`,
        expiry_date: new Date(today.getFullYear() + 1, today.getMonth() + 3, today.getDate()).toISOString().split('T')[0],
        quantity: 75,
        entry_date: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()).toISOString().split('T')[0]
      },
      {
        lot_number: `LOT-${String(productId).padStart(6, '0')}-003`,
        expiry_date: new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()).toISOString().split('T')[0],
        quantity: 100,
        entry_date: today.toISOString().split('T')[0]
      }
    ];

    let batchesCreated = 0;
    for (const batch of batches) {
      // Verificar si el lote ya existe
      const [existing] = await connection.execute(
        'SELECT id FROM product_batches WHERE product_id = ? AND lot_number = ?',
        [productId, batch.lot_number]
      );

      if (existing.length > 0) {
        // Actualizar el RFID si no lo tiene
        await connection.execute(
          'UPDATE product_batches SET rfid_uid = ? WHERE id = ?',
          [rfidCode, existing[0].id]
        );
        console.log(`  ✓ Lote ${batch.lot_number} actualizado con RFID ${rfidCode}`);
      } else {
        // Crear nuevo lote
        await connection.execute(
          `INSERT INTO product_batches 
           (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            productId,
            batch.lot_number,
            batch.expiry_date,
            batch.quantity,
            rfidCode,
            batch.entry_date
          ]
        );
        batchesCreated++;
        console.log(`  ✓ Lote ${batch.lot_number} creado - Cantidad: ${batch.quantity} - Vencimiento: ${batch.expiry_date}`);
      }
    }

    // Resumen final
    const [allBatches] = await connection.execute(
      'SELECT lot_number, quantity, expiry_date FROM product_batches WHERE product_id = ? AND rfid_uid = ? ORDER BY expiry_date',
      [productId, rfidCode]
    );

    console.log(`\n✅ Resumen:`);
    console.log(`   Producto: ${productName}`);
    console.log(`   RFID: ${rfidCode}`);
    console.log(`   Total de lotes: ${allBatches.length}`);
    console.log(`   Stock total: ${allBatches.reduce((sum, b) => sum + b.quantity, 0)} unidades`);
    console.log(`\n📋 Lotes creados:`);
    allBatches.forEach((batch, index) => {
      console.log(`   ${index + 1}. ${batch.lot_number} - ${batch.quantity} unidades - Vence: ${batch.expiry_date}`);
    });
    
    console.log(`\n💡 Para ver estos lotes:`);
    console.log(`   1. Ve a la página de Stock (http://localhost:5173/stock)`);
    console.log(`   2. Busca el producto "${productName}" o el RFID "${rfidCode}"`);
    console.log(`   3. Haz clic en el botón "Stock" en la fila del producto`);
    console.log(`   4. Verás ${allBatches.length} filas diferentes (una por cada lote) con el mismo RFID`);

  } catch (error) {
    console.error('✗ Error al crear ejemplo:', error);
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
  createMultipleBatchesExample()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { createMultipleBatchesExample };

