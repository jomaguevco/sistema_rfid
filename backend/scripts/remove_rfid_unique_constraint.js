/**
 * Script para eliminar la restricción UNIQUE en rfid_uid de product_batches
 * Esto permite que múltiples lotes compartan el mismo RFID
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function removeRfidUniqueConstraint() {
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

    // Verificar si existe la restricción UNIQUE en rfid_uid
    console.log('\n🔍 Verificando restricciones en product_batches...');
    
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM product_batches WHERE Key_name = 'rfid_uid' AND Non_unique = 0
    `);

    if (indexes.length > 0) {
      console.log('⚠️  Encontrada restricción UNIQUE en rfid_uid');
      
      // Intentar eliminar la restricción UNIQUE
      try {
        await connection.execute('ALTER TABLE product_batches DROP INDEX rfid_uid');
        console.log('✅ Restricción UNIQUE eliminada de rfid_uid');
      } catch (error) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
          // Si no se puede eliminar así, intentar de otra manera
          console.log('⚠️  Intentando método alternativo...');
          // Verificar el nombre exacto de la restricción
          const [constraints] = await connection.execute(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'product_batches' 
            AND CONSTRAINT_TYPE = 'UNIQUE' 
            AND CONSTRAINT_NAME LIKE '%rfid%'
          `, [process.env.DB_NAME || 'rfid_stock_db']);
          
          if (constraints.length > 0) {
            for (const constraint of constraints) {
              try {
                await connection.execute(`ALTER TABLE product_batches DROP INDEX ${constraint.CONSTRAINT_NAME}`);
                console.log(`✅ Restricción ${constraint.CONSTRAINT_NAME} eliminada`);
              } catch (err) {
                console.error(`⚠️  No se pudo eliminar ${constraint.CONSTRAINT_NAME}:`, err.message);
              }
            }
          }
        } else {
          throw error;
        }
      }

      // Recrear el índice sin UNIQUE
      try {
        await connection.execute('CREATE INDEX idx_rfid_uid ON product_batches(rfid_uid)');
        console.log('✅ Índice no único recreado en rfid_uid');
      } catch (error) {
        if (error.code !== 'ER_DUP_KEYNAME') {
          console.warn('⚠️  No se pudo recrear el índice:', error.message);
        } else {
          console.log('✓ Índice ya existe');
        }
      }
    } else {
      console.log('✅ No se encontró restricción UNIQUE en rfid_uid');
      console.log('   La tabla ya permite múltiples lotes con el mismo RFID');
    }

    // Verificar el resultado final
    const [finalIndexes] = await connection.execute(`
      SHOW INDEX FROM product_batches WHERE Column_name = 'rfid_uid'
    `);
    
    const hasUnique = finalIndexes.some(idx => idx.Non_unique === 0);
    
    if (!hasUnique) {
      console.log('\n✅ Verificación exitosa: Múltiples lotes pueden compartir el mismo RFID');
    } else {
      console.log('\n⚠️  Aún existe una restricción UNIQUE. Es posible que necesites ejecutar manualmente:');
      console.log('   ALTER TABLE product_batches DROP INDEX rfid_uid;');
      console.log('   CREATE INDEX idx_rfid_uid ON product_batches(rfid_uid);');
    }

    console.log('\n✓ Proceso completado');

  } catch (error) {
    console.error('✗ Error al eliminar restricción:', error);
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
  removeRfidUniqueConstraint()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { removeRfidUniqueConstraint };

