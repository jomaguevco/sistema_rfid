const mysql = require('mysql2/promise');
require('dotenv').config();

async function deleteDimenhidrinato() {
  let connection;
  
  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
      database: process.env.DB_NAME || 'rfid_stock_db'
    });

    console.log('🔍 Buscando productos Dimenhidrinato...\n');

    // Buscar productos con nombre Dimenhidrinato
    const [products] = await connection.execute(
      'SELECT id, name, rfid_uid FROM products WHERE name LIKE ?',
      ['%Dimenhidrinato%']
    );

    if (products.length === 0) {
      console.log('✅ No se encontraron productos Dimenhidrinato');
      return;
    }

    console.log(`📦 Productos encontrados: ${products.length}`);
    products.forEach(p => {
      console.log(`  - ID: ${p.id}, Nombre: ${p.name}, RFID: ${p.rfid_uid || 'N/A'}`);
    });

    // Para cada producto, buscar sus lotes
    for (const product of products) {
      console.log(`\n🔍 Buscando lotes para producto ID ${product.id}...`);
      
      const [batches] = await connection.execute(
        'SELECT id, lot_number, expiry_date, quantity, rfid_uid FROM product_batches WHERE product_id = ?',
        [product.id]
      );

      console.log(`  📋 Lotes encontrados: ${batches.length}`);
      batches.forEach(b => {
        console.log(`    - Lote ID: ${b.id}, Lote: ${b.lot_number}, Cantidad: ${b.quantity}, RFID: ${b.rfid_uid || 'N/A'}`);
      });

      // Verificar dependencias
      console.log(`\n🔍 Verificando dependencias para producto ID ${product.id}...`);
      
      // Verificar si hay recetas que usan este producto
      const [prescriptionItems] = await connection.execute(
        'SELECT COUNT(*) as count FROM prescription_items WHERE product_id = ?',
        [product.id]
      );

      if (prescriptionItems[0].count > 0) {
        console.log(`  ⚠️  El producto tiene ${prescriptionItems[0].count} items en recetas`);
        console.log(`  💡 Eliminando items de recetas primero...`);
        
        await connection.execute(
          'DELETE FROM prescription_items WHERE product_id = ?',
          [product.id]
        );
        console.log(`  ✅ Items de recetas eliminados`);
      }

      // Eliminar lotes primero
      if (batches.length > 0) {
        console.log(`\n🗑️  Eliminando ${batches.length} lotes...`);
        await connection.execute(
          'DELETE FROM product_batches WHERE product_id = ?',
          [product.id]
        );
        console.log(`  ✅ Lotes eliminados`);
      }

      // Eliminar el producto
      console.log(`\n🗑️  Eliminando producto ID ${product.id}...`);
      await connection.execute(
        'DELETE FROM products WHERE id = ?',
        [product.id]
      );
      console.log(`  ✅ Producto eliminado`);
    }

    console.log('\n✅ Proceso completado');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Ejecutar
deleteDimenhidrinato();

