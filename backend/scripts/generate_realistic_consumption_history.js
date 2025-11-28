/**
 * Script para generar datos históricos REALES y REALISTAS de consumo
 * Simula consumo diario de productos en los últimos 90 días
 * Genera patrones realistas con variación diaria, semanal y mensual
 * 
 * Este script crea transacciones de consumo realistas que dan sentido a las predicciones
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Función para obtener fecha de hace N días
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Función para generar consumo diario realista
function generateDailyConsumption(baseConsumption, dayOfWeek, variation) {
  // Ajustes por día de la semana (lunes-viernes más consumo)
  const dayMultiplier = [0.6, 0.8, 1.0, 1.0, 1.0, 1.2, 0.7]; // Domingo, Lunes... Sábado
  
  // Variación aleatoria suave (-20% a +20%)
  const randomVariation = 1 + (variation * 0.4 - 0.2);
  
  // Aplicar multiplicador del día y variación
  let consumption = baseConsumption * dayMultiplier[dayOfWeek] * randomVariation;
  
  // Asegurar mínimo de 0 y valores enteros realistas
  consumption = Math.max(0, Math.round(consumption));
  
  return consumption;
}

// Función para obtener productos con lotes activos
async function getProductsWithActiveBatches(connection) {
  const [products] = await connection.execute(`
    SELECT DISTINCT
      p.id,
      p.name,
      p.product_type,
      pb.id as batch_id,
      pb.quantity as batch_quantity,
      pb.entry_date,
      pb.expiry_date
    FROM products p
    JOIN product_batches pb ON p.id = pb.product_id
    WHERE pb.quantity > 0
      AND pb.expiry_date >= CURDATE()
    ORDER BY p.id, pb.entry_date ASC
  `);
  
  // Agrupar por producto
  const productsMap = {};
  products.forEach(row => {
    if (!productsMap[row.id]) {
      productsMap[row.id] = {
        id: row.id,
        name: row.name,
        product_type: row.product_type,
        batches: []
      };
    }
    productsMap[row.id].batches.push({
      id: row.batch_id,
      quantity: row.batch_quantity,
      entry_date: row.entry_date,
      expiry_date: row.expiry_date
    });
  });
  
  return Object.values(productsMap);
}

// Función para calcular consumo base según tipo de producto
function getBaseConsumption(productType, totalStock) {
  // Consumo diario base como porcentaje del stock total
  const consumptionRates = {
    'medicamento': 0.015,  // 1.5% del stock diario (uso moderado)
    'insumo': 0.025,       // 2.5% del stock diario (uso frecuente)
    'dispositivo': 0.008,  // 0.8% del stock diario (uso bajo)
    'vacuna': 0.010        // 1% del stock diario (uso moderado-bajo)
  };
  
  const rate = consumptionRates[productType] || 0.015;
  const base = Math.max(1, Math.round(totalStock * rate));
  
  return base;
}

async function generateRealisticConsumptionHistory() {
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
    
    // Verificar que la base de datos existe y está accesible
    await connection.execute('SELECT 1');
    console.log('✓ Base de datos accesible\n');
    
    console.log('📊 Generando datos históricos REALISTAS de consumo...');
    console.log('   Este proceso puede tomar varios minutos dependiendo de la cantidad de productos\n');

    // Obtener productos con lotes activos
    console.log('📦 Obteniendo productos con lotes activos...');
    const products = await getProductsWithActiveBatches(connection);
    console.log(`  ✓ Encontrados ${products.length} productos con lotes activos\n`);

    if (products.length === 0) {
      console.log('⚠️  No hay productos con lotes activos. No se pueden generar datos históricos.');
      return;
    }

    // Verificar si ya hay datos históricos recientes
    const [existingHistory] = await connection.execute(`
      SELECT COUNT(*) as count, MAX(consumption_date) as latest_date
      FROM stock_history
      WHERE consumption_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        AND action = 'remove'
    `);
    
    const existingCount = existingHistory[0]?.count || 0;
    const latestDate = existingHistory[0]?.latest_date;

    if (existingCount > 100) {
      console.log(`⚠️  Ya existen ${existingCount} registros de consumo en los últimos 90 días.`);
      console.log(`    Última fecha: ${latestDate}`);
      console.log(`    ¿Deseas continuar de todas formas? El script agregará más datos históricos.\n`);
    }

    // Obtener áreas disponibles
    const [areas] = await connection.execute(`
      SELECT id, name FROM areas LIMIT 10
    `);
    const areaIds = areas.map(a => a.id);
    const hasAreas = areaIds.length > 0;

    let totalRecordsCreated = 0;
    const daysToGenerate = 90; // Últimos 90 días

    // Generar consumo histórico para cada producto
    for (const product of products) {
      try {
        console.log(`📋 Procesando: ${product.name} (ID: ${product.id})`);
        
        // Calcular stock total del producto
        const totalStock = product.batches.reduce((sum, batch) => sum + batch.quantity, 0);
        
        if (totalStock === 0) {
          console.log(`  ⚠️  Sin stock, saltando...\n`);
          continue;
        }

        // Calcular consumo base diario
        const baseDailyConsumption = getBaseConsumption(product.product_type, totalStock);
        console.log(`  📊 Stock total: ${totalStock} unidades`);
        console.log(`  📈 Consumo diario base estimado: ${baseDailyConsumption} unidades`);

        // Seleccionar el lote más antiguo disponible para consumo (FIFO)
        let currentBatchIndex = 0;
        let currentBatchStock = product.batches[0]?.quantity || 0;
        let batchStockByDate = {};

        // Inicializar stock por fecha para cada lote
        product.batches.forEach(batch => {
          const entryDate = new Date(batch.entry_date || Date.now());
          const dateStr = entryDate.toISOString().split('T')[0];
          if (!batchStockByDate[dateStr]) {
            batchStockByDate[dateStr] = batch.quantity;
          }
        });

        const consumptionRecords = [];
        let cumulativeConsumption = 0;

        // Generar consumo día por día (del más antiguo al más reciente)
        for (let day = daysToGenerate; day >= 1; day--) {
          const date = new Date();
          date.setDate(date.getDate() - day);
          const dateStr = date.toISOString().split('T')[0];
          const dayOfWeek = date.getDay();

          // Encontrar el lote más antiguo disponible para esta fecha (FIFO)
          let activeBatch = null;
          let batchStockBeforeConsumption = 0;

          for (const batch of product.batches) {
            const batchEntryDate = new Date(batch.entry_date || Date.now() - 365 * 24 * 60 * 60 * 1000);
            const batchEntryStr = batchEntryDate.toISOString().split('T')[0];
            
            // Solo considerar lotes que ya existían en esta fecha
            if (dateStr >= batchEntryStr) {
              // Calcular consumo previo de este lote hasta esta fecha
              const previousConsumption = consumptionRecords
                .filter(r => r.date < dateStr && r.batch_id === batch.id)
                .reduce((sum, r) => sum + r.consumption, 0);
              
              const availableStock = Math.max(0, batch.quantity - previousConsumption);
              
              // Usar el lote más antiguo que tenga stock (FIFO)
              if (availableStock > 0) {
                if (!activeBatch || batchEntryDate < new Date(activeBatch.entry_date)) {
                  activeBatch = batch;
                  batchStockBeforeConsumption = availableStock;
                }
              }
            }
          }

          if (!activeBatch || batchStockBeforeConsumption <= 0) {
            // Sin stock disponible en esta fecha, saltar
            continue;
          }

          // Generar consumo para este día
          const variation = Math.random(); // Para variación diaria
          let dailyConsumption = generateDailyConsumption(baseDailyConsumption, dayOfWeek, variation);
          
          // Limitar consumo a máximo 50% del stock disponible para ser realista
          dailyConsumption = Math.min(dailyConsumption, Math.max(1, Math.floor(batchStockBeforeConsumption * 0.5)));

          // Saltar algunos días aleatoriamente para simular días sin consumo (~25% de los días)
          if (Math.random() > 0.75) {
            continue;
          }

          // Calcular stock anterior y nuevo
          const previousConsumption = consumptionRecords
            .filter(r => r.date < dateStr && r.batch_id === activeBatch.id)
            .reduce((sum, r) => sum + r.consumption, 0);
          
          const previousStock = Math.max(0, activeBatch.quantity - previousConsumption);
          const newStock = Math.max(0, previousStock - dailyConsumption);

          // Seleccionar área aleatoria si hay áreas disponibles (50% de probabilidad)
          const areaId = hasAreas && Math.random() > 0.5 
            ? areaIds[Math.floor(Math.random() * areaIds.length)]
            : null;

          consumptionRecords.push({
            date: dateStr,
            product_id: product.id,
            batch_id: activeBatch.id,
            area_id: areaId,
            previous_stock: previousStock,
            new_stock: newStock,
            consumption: dailyConsumption
          });

          cumulativeConsumption += dailyConsumption;
        }

        console.log(`  ✓ Generados ${consumptionRecords.length} días con consumo`);
        console.log(`  📊 Consumo total simulado: ${cumulativeConsumption} unidades\n`);

        // Insertar registros en la base de datos en lotes
        if (consumptionRecords.length > 0) {
          const batchSize = 100;
          let inserted = 0;

          // Verificar qué registros ya existen para evitar duplicados
          for (let i = 0; i < consumptionRecords.length; i += batchSize) {
            const batch = consumptionRecords.slice(i, i + batchSize);
            const recordsToInsert = [];

            for (const record of batch) {
              // Verificar si ya existe un registro similar
              const [existing] = await connection.execute(`
                SELECT id FROM stock_history
                WHERE product_id = ?
                  AND batch_id = ?
                  AND consumption_date = ?
                  AND action = 'remove'
                  AND ABS(previous_stock - ?) <= 5
                LIMIT 1
              `, [
                record.product_id,
                record.batch_id,
                record.date,
                record.previous_stock
              ]);

              if (existing.length === 0) {
                recordsToInsert.push([
                  record.product_id,
                  record.batch_id,
                  record.area_id,
                  record.previous_stock,
                  record.new_stock,
                  'remove',
                  record.date,
                  `Consumo diario simulado - ${record.consumption} unidades`,
                  record.date + ' 08:00:00' // Hora simulada
                ]);
              }
            }

            if (recordsToInsert.length > 0) {
              const placeholders = recordsToInsert.map(() => 
                '(?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).join(', ');
              const values = recordsToInsert.flat();

              await connection.execute(`
                INSERT INTO stock_history 
                (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes, created_at)
                VALUES ${placeholders}
              `, values);

              inserted += recordsToInsert.length;
              totalRecordsCreated += recordsToInsert.length;
            }
          }

          console.log(`  ✅ Insertados ${inserted} registros nuevos en la base de datos\n`);
        }

      } catch (error) {
        console.error(`  ✗ Error procesando producto ${product.id}:`, error.message);
        console.error(`    ${error.stack}\n`);
      }
    }

    // Resumen final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE GENERACIÓN DE DATOS HISTÓRICOS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Total de registros creados: ${totalRecordsCreated}`);
    console.log(`📦 Productos procesados: ${products.length}`);
    
    // Estadísticas finales
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT product_id) as products_with_history,
        COUNT(*) as total_records,
        MIN(consumption_date) as earliest_date,
        MAX(consumption_date) as latest_date,
        SUM(previous_stock - new_stock) as total_consumption
      FROM stock_history
      WHERE consumption_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        AND action = 'remove'
    `);

    console.log(`\n📈 Estadísticas del historial:`);
    console.log(`  - Productos con historial: ${stats[0].products_with_history}`);
    console.log(`  - Total de registros (últimos 90 días): ${stats[0].total_records}`);
    console.log(`  - Fecha más antigua: ${stats[0].earliest_date || 'N/A'}`);
    console.log(`  - Fecha más reciente: ${stats[0].latest_date || 'N/A'}`);
    console.log(`  - Consumo total simulado: ${stats[0].total_consumption || 0} unidades`);
    console.log('\n✅ Proceso completado exitosamente\n');

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
    } else {
      console.error('✗ Error al generar datos históricos:', error.message);
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
  generateRealisticConsumptionHistory()
    .then(() => {
      console.log('✅ Script ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error al ejecutar script:', error);
      process.exit(1);
    });
}

module.exports = { generateRealisticConsumptionHistory };

