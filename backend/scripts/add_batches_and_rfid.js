/**
 * Script para agregar lotes y RFID a todos los productos existentes
 * 
 * Este script:
 * 1. Crea un lote para cada producto que no tenga lotes
 * 2. Asigna RFID a algunos productos (no todos)
 * 3. Asegura que todos los productos tengan al menos un lote
 * 
 * Uso: node backend/scripts/add_batches_and_rfid.js
 */

const db = require('../database_medical');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function addBatchesAndRFID() {
  let connection;
  
  try {
    // Crear conexión directa para ejecutar el script SQL
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
      database: process.env.DB_NAME || 'rfid_stock_db',
      multipleStatements: true
    });

    console.log('✓ Conectado a la base de datos');

    // Obtener todos los productos
    const [products] = await connection.execute(
      'SELECT id, name, min_stock FROM products'
    );

    console.log(`\n📦 Encontrados ${products.length} productos`);

    let batchesCreated = 0;
    let rfidAssigned = 0;

    for (const product of products) {
      // Verificar si el producto ya tiene lotes
      const [existingBatches] = await connection.execute(
        'SELECT COUNT(*) as count FROM product_batches WHERE product_id = ?',
        [product.id]
      );

      if (existingBatches[0].count === 0) {
        // Crear un lote para este producto
        const lotNumber = `LOT-${String(product.id).padStart(6, '0')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        
        // Asignar RFID solo a algunos productos (aproximadamente 70%)
        const shouldHaveRFID = product.id % 10 < 7;
        const rfidUid = shouldHaveRFID 
          ? `RFID-${String(product.id).padStart(8, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
          : null;

        const quantity = (product.min_stock || 5) * 2;

        await connection.execute(
          `INSERT INTO product_batches (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date)
           VALUES (?, ?, ?, ?, ?, CURDATE())`,
          [product.id, lotNumber, expiryDate.toISOString().slice(0, 10), quantity, rfidUid]
        );

        batchesCreated++;
        if (rfidUid) rfidAssigned++;

        console.log(`  ✓ Lote creado para producto ${product.id}: ${product.name} (Lote: ${lotNumber}${rfidUid ? `, RFID: ${rfidUid}` : ''})`);
      }
    }

    // Asignar RFID principal a algunos productos que no lo tengan
    const [productsWithoutRFID] = await connection.execute(
      'SELECT id, name FROM products WHERE rfid_uid IS NULL'
    );

    for (const product of productsWithoutRFID) {
      // Solo asignar a aproximadamente 50% de los productos sin RFID
      if (product.id % 10 < 5) {
        const rfidUid = `PROD-${String(product.id).padStart(8, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        await connection.execute(
          'UPDATE products SET rfid_uid = ? WHERE id = ?',
          [rfidUid, product.id]
        );

        rfidAssigned++;
        console.log(`  ✓ RFID principal asignado a producto ${product.id}: ${product.name} (RFID: ${rfidUid})`);
      }
    }

    // Mostrar resumen
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT p.id) as total_productos,
        COUNT(DISTINCT pb.product_id) as productos_con_lotes,
        COUNT(DISTINCT CASE WHEN pb.rfid_uid IS NOT NULL THEN pb.product_id END) as productos_con_rfid_lote,
        COUNT(DISTINCT CASE WHEN p.rfid_uid IS NOT NULL THEN p.id END) as productos_con_rfid_principal
      FROM products p
      LEFT JOIN product_batches pb ON pb.product_id = p.id
    `);

    console.log('\n📊 Resumen:');
    console.log(`  Total productos: ${stats[0].total_productos}`);
    console.log(`  Productos con lotes: ${stats[0].productos_con_lotes}`);
    console.log(`  Productos con RFID en lote: ${stats[0].productos_con_rfid_lote}`);
    console.log(`  Productos con RFID principal: ${stats[0].productos_con_rfid_principal}`);
    console.log(`\n✅ Lotes creados: ${batchesCreated}`);
    console.log(`✅ RFID asignados: ${rfidAssigned}`);

  } catch (error) {
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Conexión cerrada');
    }
  }
}

// Ejecutar el script
if (require.main === module) {
  addBatchesAndRFID()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error al ejecutar el script:', error);
      process.exit(1);
    });
}

module.exports = { addBatchesAndRFID };

