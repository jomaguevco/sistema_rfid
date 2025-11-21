const db = require('./database_medical');

async function poblarDatosGraficos() {
  let connection;
  
  try {
    connection = await db.pool.getConnection();
    console.log('✅ Conectado a la base de datos');
    
    // Obtener IDs existentes
    const [products] = await connection.execute('SELECT id FROM products LIMIT 20');
    const [areas] = await connection.execute('SELECT id FROM areas LIMIT 5');
    const [batches] = await connection.execute('SELECT id, product_id FROM product_batches LIMIT 30');
    
    if (products.length === 0 || areas.length === 0 || batches.length === 0) {
      console.log('⚠️ No hay suficientes datos base. Ejecuta primero poblar_datos_masivos.js');
      return;
    }
    
    console.log(`📊 Insertando datos para gráficos...`);
    console.log(`   - Productos: ${products.length}`);
    console.log(`   - Áreas: ${areas.length}`);
    console.log(`   - Lotes: ${batches.length}`);
    
    // Insertar stock_history para consumo por área (últimos 30 días)
    const stockHistoryInserts = [];
    const today = new Date();
    
    for (let day = 0; day < 30; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() - day);
      const dateStr = date.toISOString().split('T')[0];
      
      // Crear 3-8 movimientos por día
      const movementsPerDay = Math.floor(Math.random() * 6) + 3;
      
      for (let i = 0; i < movementsPerDay; i++) {
        const randomBatch = batches[Math.floor(Math.random() * batches.length)];
        const randomArea = areas[Math.floor(Math.random() * areas.length)];
        const quantity = Math.floor(Math.random() * 50) + 10;
        const previousStock = quantity + Math.floor(Math.random() * 100);
        const newStock = previousStock - quantity;
        
        stockHistoryInserts.push([
          randomBatch.product_id,
          randomBatch.id,
          randomArea.id,
          previousStock,
          newStock,
          'remove',
          dateStr,
          new Date()
        ]);
      }
    }
    
    if (stockHistoryInserts.length > 0) {
      const placeholders = stockHistoryInserts.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = stockHistoryInserts.flat();
      
      await connection.execute(
        `INSERT INTO stock_history 
         (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date, created_at)
         VALUES ${placeholders}`,
        values
      );
      console.log(`✅ Insertados ${stockHistoryInserts.length} registros de historial de stock`);
    }
    
    // Actualizar fechas de vencimiento de lotes para distribución de vencimientos
    const expiryRanges = [
      { days: -10, label: 'Vencidos' },
      { days: 5, label: '0-7 días' },
      { days: 12, label: '8-15 días' },
      { days: 25, label: '16-30 días' },
      { days: 45, label: '31-60 días' },
      { days: 75, label: '61-90 días' },
      { days: 120, label: 'Más de 90 días' }
    ];
    
    let batchIndex = 0;
    for (const range of expiryRanges) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + range.days);
      const expiryDateStr = expiryDate.toISOString().split('T')[0];
      
      // Asignar 3-5 lotes por rango
      const batchesInRange = Math.min(4, batches.length - batchIndex);
      for (let i = 0; i < batchesInRange && batchIndex < batches.length; i++) {
        await connection.execute(
          'UPDATE product_batches SET expiry_date = ? WHERE id = ?',
          [expiryDateStr, batches[batchIndex].id]
        );
        batchIndex++;
      }
    }
    
    console.log(`✅ Actualizadas fechas de vencimiento de ${batchIndex} lotes`);
    
    // Asegurar que hay productos con categorías
    const [categories] = await connection.execute('SELECT id FROM product_categories');
    if (categories.length > 0) {
      const updatePromises = products.map((product, index) => {
        const categoryId = categories[index % categories.length].id;
        return connection.execute(
          'UPDATE products SET category_id = ? WHERE id = ?',
          [categoryId, product.id]
        );
      });
      await Promise.all(updatePromises);
      console.log(`✅ Asignadas categorías a ${products.length} productos`);
    }
    
    console.log('\n✅ Datos para gráficos poblados exitosamente!');
    console.log('📈 Los gráficos del dashboard ahora deberían mostrar información');
    
  } catch (error) {
    console.error('❌ Error al poblar datos:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

// Ejecutar
poblarDatosGraficos().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});

