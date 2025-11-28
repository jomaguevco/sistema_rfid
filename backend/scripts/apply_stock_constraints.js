/**
 * Script para ejecutar el SQL que agrega constraints de validación de stock
 * Previene cantidades negativas y mejora la integridad de datos
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyStockConstraints() {
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
    console.log('\n📊 Aplicando constraints de validación de stock...\n');

    // Leer el archivo SQL
    const sqlFilePath = path.join(__dirname, '../../database/add_stock_constraints.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Ejecutar el script SQL
    console.log('🔧 Ejecutando script SQL...\n');
    const [results] = await connection.query(sql);

    console.log('✅ Constraints aplicados exitosamente\n');

    // Verificar los constraints agregados
    const [constraints] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        CONSTRAINT_NAME,
        CONSTRAINT_TYPE
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('product_batches', 'stock_history')
        AND CONSTRAINT_NAME LIKE 'chk_%'
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `);

    console.log('📋 Constraints verificados:');
    if (constraints.length === 0) {
      console.log('  ⚠️  No se encontraron constraints. Puede que ya existieran.');
    } else {
      constraints.forEach(constraint => {
        console.log(`  ✓ ${constraint.TABLE_NAME}.${constraint.CONSTRAINT_NAME} (${constraint.CONSTRAINT_TYPE})`);
      });
    }

    // Verificar si hay datos negativos existentes
    console.log('\n🔍 Verificando datos existentes...\n');
    
    const [negativeBatches] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM product_batches
      WHERE quantity < 0
    `);

    const [negativeHistory] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM stock_history
      WHERE previous_stock < 0 OR new_stock < 0
    `);

    if (negativeBatches[0].count > 0) {
      console.log(`  ⚠️  ADVERTENCIA: Se encontraron ${negativeBatches[0].count} lotes con stock negativo`);
      console.log('     Estos deben corregirse antes de que los constraints funcionen correctamente.');
    } else {
      console.log('  ✓ No se encontraron lotes con stock negativo');
    }

    if (negativeHistory[0].count > 0) {
      console.log(`  ⚠️  ADVERTENCIA: Se encontraron ${negativeHistory[0].count} registros en stock_history con valores negativos`);
      console.log('     Estos deben corregirse antes de que los constraints funcionen correctamente.');
    } else {
      console.log('  ✓ No se encontraron valores negativos en stock_history');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Proceso completado exitosamente');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('\n✗ ERROR: No se pudo conectar a la base de datos MySQL');
      console.error('   Verifica que:');
      console.error('   1. MySQL esté corriendo');
      console.error('   2. Las credenciales en .env sean correctas');
      console.error('   3. La base de datos exista');
      console.error('\n   Para iniciar MySQL en Windows:');
      console.error('   - Abre "Servicios" (services.msc)');
      console.error('   - Busca "MySQL" y haz clic en "Iniciar"');
      console.error('   - O ejecuta: net start MySQL\n');
    } else if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      console.error('\n⚠️  Error: Hay datos que violan el constraint.');
      console.error('   Necesitas corregir los datos negativos antes de aplicar los constraints.');
      console.error('   Ejecuta estas consultas para ver los datos problemáticos:');
      console.error('   - SELECT * FROM product_batches WHERE quantity < 0;');
      console.error('   - SELECT * FROM stock_history WHERE previous_stock < 0 OR new_stock < 0;');
    } else {
      console.error('\n✗ Error al aplicar constraints:', error.message);
      console.error('   Detalles:', error);
    }
    
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Conexión cerrada');
    }
  }
}

// Ejecutar el script
if (require.main === module) {
  applyStockConstraints()
    .then(() => {
      console.log('✅ Script ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error al ejecutar script:', error);
      process.exit(1);
    });
}

module.exports = { applyStockConstraints };

