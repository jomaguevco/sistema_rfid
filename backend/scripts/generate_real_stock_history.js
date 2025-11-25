/**
 * Script para generar datos históricos reales en stock_history
 * basados en transacciones existentes (recetas despachadas, entradas/salidas de stock)
 * 
 * Este script es idempotente: puede ejecutarse múltiples veces sin duplicar datos
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function generateRealStockHistory() {
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
    console.log('\n📊 Generando datos históricos reales de stock...\n');

    let totalCreated = 0;
    let totalSkipped = 0;

    // ============================================================================
    // 1. PROCESAR RECETAS DESPACHADAS (prescription_fulfillments)
    // ============================================================================
    console.log('📋 Procesando recetas despachadas...');
    
    const [fulfillments] = await connection.execute(`
      SELECT 
        pf.id,
        pf.prescription_id,
        pf.prescription_item_id,
        pf.batch_id,
        pf.quantity_dispensed,
        COALESCE(pr.fulfilled_at, pr.created_at, NOW()) as fulfillment_date,
        pb.product_id,
        pb.quantity as current_batch_quantity,
        p.area_id as product_area_id
      FROM prescription_fulfillments pf
      JOIN product_batches pb ON pf.batch_id = pb.id
      JOIN prescriptions pr ON pf.prescription_id = pr.id
      LEFT JOIN prescription_items pi ON pf.prescription_item_id = pi.id
      LEFT JOIN products p ON pb.product_id = p.id
      ORDER BY COALESCE(pr.fulfilled_at, pr.created_at, NOW()) ASC
    `);

    console.log(`  Encontrados ${fulfillments.length} fulfillments de recetas`);

    let fulfillmentsCreated = 0;
    let fulfillmentsSkipped = 0;

    for (const fulfillment of fulfillments) {
      try {
        const consumptionDate = fulfillment.fulfillment_date 
          ? new Date(fulfillment.fulfillment_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // Verificar si ya existe un registro para este fulfillment
        const [existing] = await connection.execute(`
          SELECT id FROM stock_history 
          WHERE product_id = ? 
            AND batch_id = ? 
            AND action = 'remove'
            AND consumption_date = ?
            AND notes LIKE ?
          LIMIT 1
        `, [
          fulfillment.product_id,
          fulfillment.batch_id,
          consumptionDate,
          `%Receta ${fulfillment.prescription_id}%`
        ]);

        if (existing.length > 0) {
          fulfillmentsSkipped++;
          continue;
        }

        // Calcular previous_stock y new_stock
        // Necesitamos obtener el stock del batch antes del despacho
        // Para esto, sumamos todas las transacciones anteriores a esta fecha
        const [previousTransactions] = await connection.execute(`
          SELECT 
            COALESCE(SUM(CASE WHEN action = 'add' THEN new_stock - previous_stock ELSE 0 END), 0) as total_added,
            COALESCE(SUM(CASE WHEN action = 'remove' THEN previous_stock - new_stock ELSE 0 END), 0) as total_removed
          FROM stock_history
          WHERE batch_id = ? 
            AND consumption_date < ?
        `, [fulfillment.batch_id, consumptionDate]);

        const totalAdded = Number(previousTransactions[0]?.total_added) || 0;
        const totalRemoved = Number(previousTransactions[0]?.total_removed) || 0;
        
        // Obtener cantidad inicial del batch
        const [batchInfo] = await connection.execute(`
          SELECT quantity, entry_date 
          FROM product_batches 
          WHERE id = ?
        `, [fulfillment.batch_id]);

        const batchQuantity = Number(batchInfo[0]?.quantity) || 0;
        const entryDate = batchInfo[0]?.entry_date 
          ? new Date(batchInfo[0].entry_date).toISOString().split('T')[0]
          : null;

        // Calcular stock previo: cantidad inicial + entradas - salidas anteriores
        // Si hay entrada inicial registrada, usarla; si no, usar la cantidad del batch
        let previousStock = batchQuantity + totalAdded - totalRemoved;
        
        // Si no hay historial previo y la fecha de entrada es posterior o igual, 
        // usar la cantidad actual + cantidad despachada como aproximación
        if (totalAdded === 0 && totalRemoved === 0 && entryDate && consumptionDate >= entryDate) {
          previousStock = fulfillment.current_batch_quantity + fulfillment.quantity_dispensed;
        }

        const newStock = Math.max(0, previousStock - fulfillment.quantity_dispensed);
        const areaId = fulfillment.product_area_id || null;

        // Insertar registro en stock_history
        await connection.execute(`
          INSERT INTO stock_history 
          (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes, created_at)
          VALUES (?, ?, ?, ?, ?, 'remove', ?, ?, ?)
        `, [
          fulfillment.product_id,
          fulfillment.batch_id,
          areaId,
          previousStock,
          newStock,
          consumptionDate,
          `Despacho de receta ${fulfillment.prescription_id} - Item ${fulfillment.prescription_item_id}`,
          fulfillment.fulfillment_date || new Date()
        ]);

        fulfillmentsCreated++;
        totalCreated++;
      } catch (error) {
        console.error(`  ✗ Error procesando fulfillment ${fulfillment.id}:`, error.message);
        fulfillmentsSkipped++;
        totalSkipped++;
      }
    }

    console.log(`  ✓ Procesados: ${fulfillments.length} fulfillments`);
    console.log(`  ✓ Creados: ${fulfillmentsCreated} registros nuevos`);
    console.log(`  ✓ Omitidos: ${fulfillmentsSkipped} (ya existían)\n`);

    // ============================================================================
    // 2. PROCESAR ENTRADAS DE STOCK FALTANTES (basadas en entry_date de batches)
    // ============================================================================
    console.log('📥 Procesando entradas de stock faltantes...');
    
    // Primero obtener los batch_ids que ya tienen registros de entrada
    const [existingEntries] = await connection.execute(`
      SELECT DISTINCT batch_id 
      FROM stock_history 
      WHERE action = 'add'
    `);
    const existingBatchIds = new Set(existingEntries.map(e => e.batch_id));

    const [batchesWithEntryDate] = await connection.execute(`
      SELECT 
        pb.id as batch_id,
        pb.product_id,
        pb.quantity,
        pb.entry_date,
        p.area_id
      FROM product_batches pb
      JOIN products p ON pb.product_id = p.id
      WHERE pb.entry_date IS NOT NULL
        AND pb.entry_date <= CURDATE()
      ORDER BY pb.entry_date ASC
    `);

    console.log(`  Encontrados ${batchesWithEntryDate.length} lotes con fecha de entrada`);

    let entriesCreated = 0;
    let entriesSkipped = 0;
    const entriesToInsert = [];

    // Preparar todos los inserts en memoria primero
    for (const batch of batchesWithEntryDate) {
      try {
        // Verificar si ya existe un registro de entrada para este batch
        if (existingBatchIds.has(batch.batch_id)) {
          entriesSkipped++;
          continue;
        }

        const entryDate = new Date(batch.entry_date).toISOString().split('T')[0];
        const previousStock = 0;
        const newStock = batch.quantity;

        entriesToInsert.push([
          batch.product_id,
          batch.batch_id,
          batch.area_id,
          previousStock,
          newStock,
          'add',
          entryDate,
          'Ingreso inicial de lote',
          batch.entry_date
        ]);
      } catch (error) {
        console.error(`  ✗ Error preparando entrada de batch ${batch.batch_id}:`, error.message);
        entriesSkipped++;
        totalSkipped++;
      }
    }

    // Insertar en lotes para mejor rendimiento
    if (entriesToInsert.length > 0) {
      console.log(`  Insertando ${entriesToInsert.length} registros de entrada...`);
      const batchSize = 100;
      for (let i = 0; i < entriesToInsert.length; i += batchSize) {
        const batch = entriesToInsert.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flat();

        await connection.execute(`
          INSERT INTO stock_history 
          (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, notes, created_at)
          VALUES ${placeholders}
        `, values);

        entriesCreated += batch.length;
        totalCreated += batch.length;
        
        if ((i + batchSize) % 500 === 0) {
          console.log(`    Procesados ${Math.min(i + batchSize, entriesToInsert.length)} de ${entriesToInsert.length}...`);
        }
      }
    }

    console.log(`  ✓ Creados: ${entriesCreated} registros nuevos`);
    console.log(`  ✓ Omitidos: ${entriesSkipped} (ya existían)\n`);

    // ============================================================================
    // 3. RESUMEN FINAL
    // ============================================================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE GENERACIÓN DE DATOS HISTÓRICOS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✓ Total de registros creados: ${totalCreated}`);
    console.log(`✓ Total de registros omitidos (ya existían): ${totalSkipped}`);
    console.log(`\n  - Recetas despachadas: ${fulfillmentsCreated} nuevos`);
    console.log(`  - Entradas de stock: ${entriesCreated} nuevos`);
    console.log('\n✓ Proceso completado exitosamente\n');

    // Verificar cobertura de datos históricos
    const [historyStats] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT product_id) as products_with_history,
        COUNT(*) as total_records,
        MIN(consumption_date) as earliest_date,
        MAX(consumption_date) as latest_date
      FROM stock_history
    `);

    console.log('📈 Estadísticas del historial generado:');
    console.log(`  - Productos con historial: ${historyStats[0].products_with_history}`);
    console.log(`  - Total de registros: ${historyStats[0].total_records}`);
    console.log(`  - Fecha más antigua: ${historyStats[0].earliest_date || 'N/A'}`);
    console.log(`  - Fecha más reciente: ${historyStats[0].latest_date || 'N/A'}\n`);

  } catch (error) {
    console.error('✗ Error al generar datos históricos:', error);
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
  generateRealStockHistory()
    .then(() => {
      console.log('✅ Script ejecutado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error al ejecutar script:', error);
      process.exit(1);
    });
}

module.exports = { generateRealStockHistory };

