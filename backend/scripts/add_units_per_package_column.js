/**
 * Script para agregar la columna units_per_package a la tabla products
 * si no existe
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function addUnitsPerPackageColumn() {
  let connection;

  try {
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rfid_stock_db'
    });

    console.log('✓ Conectado a la base de datos');

    // Verificar si la columna existe
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'products' 
         AND COLUMN_NAME = 'units_per_package'`,
      [process.env.DB_NAME || 'rfid_stock_db']
    );

    if (columns.length > 0) {
      console.log('✓ La columna units_per_package ya existe');
      return;
    }

    // Agregar la columna
    console.log('Agregando columna units_per_package...');
    await connection.execute(
      `ALTER TABLE products 
       ADD COLUMN units_per_package INT DEFAULT 1 
       COMMENT 'Unidades por caja/paquete (ej: 10 pastillas por caja)'`
    );

    console.log('✓ Columna units_per_package agregada correctamente');

    // Verificar que se agregó
    const [verify] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'products'
         AND COLUMN_NAME = 'units_per_package'`,
      [process.env.DB_NAME || 'rfid_stock_db']
    );

    if (verify.length > 0) {
      console.log('\n✓ Verificación exitosa:');
      console.log('  Columna:', verify[0].COLUMN_NAME);
      console.log('  Tipo:', verify[0].DATA_TYPE);
      console.log('  Valor por defecto:', verify[0].COLUMN_DEFAULT);
      console.log('  Comentario:', verify[0].COLUMN_COMMENT);
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  La columna ya existe, no se necesita agregar');
    } else {
      throw error;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ Conexión cerrada');
    }
  }
}

// Ejecutar el script
addUnitsPerPackageColumn()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error al ejecutar el script:', error);
    process.exit(1);
  });

