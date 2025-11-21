// Script para poblar masivamente todas las tablas con muchos datos
const mysql = require('mysql2/promise');

require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME || 'rfid_stock_db',
  multipleStatements: true
};

// Generar RFID UIDs aleatorios
function generarRFID() {
  const chars = '0123456789ABCDEF';
  let uid = '';
  for (let i = 0; i < 8; i++) {
    uid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return uid;
}

// Generar número de lote
function generarLote(prefijo, año, numero) {
  return `${prefijo}-${año}-${String(numero).padStart(3, '0')}`;
}

async function poblarDatosMasivos() {
  let connection;
  try {
    console.log('🚀 Poblando masivamente todas las tablas...\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Conexión establecida\n');
    
    // Obtener IDs existentes
    const [categories] = await connection.query('SELECT id FROM product_categories ORDER BY id');
    const [areas] = await connection.query('SELECT id FROM areas ORDER BY id');
    const [existingProducts] = await connection.query('SELECT id FROM products ORDER BY id');
    
    const categoryIds = categories.map(c => c.id);
    const areaIds = areas.map(a => a.id);
    const existingProductIds = existingProducts.map(p => p.id);
    
    console.log(`📊 Estado actual:`);
    console.log(`   Categorías: ${categoryIds.length}`);
    console.log(`   Áreas: ${areaIds.length}`);
    console.log(`   Productos existentes: ${existingProductIds.length}\n`);
    
    // ============================================================================
    // 1. INSERTAR MUCHOS PRODUCTOS ADICIONALES
    // ============================================================================
    console.log('📝 [1/8] Insertando productos adicionales...');
    
    const productosAdicionales = [
      // Antibióticos
      ['Amoxicilina 250mg', 'Antibiótico pediátrico', 'medicamento', 'Amoxicilina', '250mg', 'Suspensión', 'Oral', categoryIds[0], 40],
      ['Penicilina G 1.2MU', 'Antibiótico inyectable', 'medicamento', 'Penicilina G', '1.2MU', 'Vial', 'Intramuscular', categoryIds[0], 25],
      ['Eritromicina 500mg', 'Antibiótico macrólido', 'medicamento', 'Eritromicina', '500mg', 'Tabletas', 'Oral', categoryIds[0], 30],
      ['Clindamicina 300mg', 'Antibiótico para infecciones anaerobias', 'medicamento', 'Clindamicina', '300mg', 'Cápsulas', 'Oral', categoryIds[0], 20],
      ['Vancomicina 500mg', 'Antibiótico para infecciones graves', 'medicamento', 'Vancomicina', '500mg', 'Vial', 'Intravenosa', categoryIds[0], 15],
      
      // Analgésicos
      ['Acetaminofén 1000mg', 'Analgésico de alta potencia', 'medicamento', 'Acetaminofén', '1000mg', 'Tabletas', 'Oral', categoryIds[1], 60],
      ['Naproxeno 500mg', 'Antiinflamatorio', 'medicamento', 'Naproxeno', '500mg', 'Tabletas', 'Oral', categoryIds[1], 45],
      ['Codeína 30mg', 'Analgésico opioide', 'medicamento', 'Codeína', '30mg', 'Tabletas', 'Oral', categoryIds[1], 20],
      ['Fentanilo 50mcg', 'Analgésico opioide potente', 'medicamento', 'Fentanilo', '50mcg', 'Parche', 'Transdérmico', categoryIds[1], 10],
      ['Diclofenaco Gel 1%', 'Antiinflamatorio tópico', 'medicamento', 'Diclofenaco', '1%', 'Gel 100g', 'Tópico', categoryIds[1], 35],
      
      // Antisépticos
      ['Hipoclorito de Sodio 0.5%', 'Desinfectante', 'insumo', 'Hipoclorito de sodio', '0.5%', 'Botella 1L', 'Tópico', categoryIds[2], 30],
      ['Benzalconio Cloruro', 'Antiséptico', 'insumo', 'Benzalconio cloruro', '0.1%', 'Solución 500ml', 'Tópico', categoryIds[2], 25],
      ['Hexaclorofeno', 'Antiséptico quirúrgico', 'insumo', 'Hexaclorofeno', '3%', 'Jabón 500ml', 'Tópico', categoryIds[2], 20],
      
      // Material de Curación
      ['Compresas Estériles', 'Compresas para heridas', 'insumo', null, null, 'Paquete x20', 'Tópico', categoryIds[3], 60],
      ['Cinta Micropore', 'Cinta adhesiva médica', 'insumo', null, '2.5cm', 'Rollo', 'Tópico', categoryIds[3], 50],
      ['Guantes Estériles Talla M', 'Guantes quirúrgicos', 'insumo', null, 'Talla M', 'Caja x100', 'Tópico', categoryIds[3], 80],
      ['Guantes Estériles Talla L', 'Guantes quirúrgicos', 'insumo', null, 'Talla L', 'Caja x100', 'Tópico', categoryIds[3], 70],
      ['Mascarillas Quirúrgicas', 'Mascarillas desechables', 'insumo', null, null, 'Caja x50', 'Tópico', categoryIds[3], 100],
      ['Batas Quirúrgicas', 'Batas estériles desechables', 'insumo', null, 'Talla Universal', 'Unidad', 'Tópico', categoryIds[3], 40],
      
      // Cardiovasculares
      ['Enalapril 10mg', 'Inhibidor de ECA', 'medicamento', 'Enalapril', '10mg', 'Tabletas', 'Oral', categoryIds[5], 40],
      ['Amlodipino 5mg', 'Bloqueador de canales de calcio', 'medicamento', 'Amlodipino', '5mg', 'Tabletas', 'Oral', categoryIds[5], 35],
      ['Metoprolol 50mg', 'Betabloqueante', 'medicamento', 'Metoprolol', '50mg', 'Tabletas', 'Oral', categoryIds[5], 30],
      ['Warfarina 5mg', 'Anticoagulante', 'medicamento', 'Warfarina', '5mg', 'Tabletas', 'Oral', categoryIds[5], 25],
      ['Aspirina 100mg', 'Antiagregante plaquetario', 'medicamento', 'Ácido acetilsalicílico', '100mg', 'Tabletas', 'Oral', categoryIds[5], 50],
      
      // Respiratorios
      ['Ipratropio Inhalador', 'Broncodilatador', 'medicamento', 'Ipratropio', '20mcg', 'Inhalador', 'Inhalación', categoryIds[6], 30],
      ['Beclometasona Inhalador', 'Corticosteroide inhalado', 'medicamento', 'Beclometasona', '250mcg', 'Inhalador', 'Inhalación', categoryIds[6], 25],
      ['Teofilina 200mg', 'Broncodilatador de acción prolongada', 'medicamento', 'Teofilina', '200mg', 'Tabletas', 'Oral', categoryIds[6], 20],
      
      // Suplementos
      ['Hierro Sulfato 200mg', 'Suplemento de hierro', 'medicamento', 'Hierro sulfato', '200mg', 'Tabletas', 'Oral', categoryIds[7], 40],
      ['Calcio Carbonato 500mg', 'Suplemento de calcio', 'medicamento', 'Calcio carbonato', '500mg', 'Tabletas', 'Oral', categoryIds[7], 45],
      ['Multivitamínico', 'Complejo vitamínico', 'medicamento', 'Múltiples', null, 'Tabletas', 'Oral', categoryIds[7], 50],
      ['Ácido Ascórbico 1000mg', 'Vitamina C', 'medicamento', 'Ácido ascórbico', '1000mg', 'Tabletas', 'Oral', categoryIds[7], 35],
      
      // Equipos Médicos
      ['Jeringas 5ml', 'Jeringas desechables', 'insumo', null, '5ml', 'Caja x100', 'Intravenosa', categoryIds[4], 200],
      ['Jeringas 10ml', 'Jeringas desechables', 'insumo', null, '10ml', 'Caja x100', 'Intravenosa', categoryIds[4], 150],
      ['Agujas 21G', 'Agujas para inyección', 'insumo', null, '21G', 'Caja x100', 'Intravenosa', categoryIds[4], 180],
      ['Agujas 23G', 'Agujas para inyección', 'insumo', null, '23G', 'Caja x100', 'Intravenosa', categoryIds[4], 170],
      ['Catéteres IV 18G', 'Catéteres intravenosos', 'insumo', null, '18G', 'Unidad', 'Intravenosa', categoryIds[4], 120],
      ['Sueros Fisiológicos 500ml', 'Solución salina', 'insumo', 'Cloruro de sodio', '0.9%', 'Bolsa 500ml', 'Intravenosa', categoryIds[4], 100],
      ['Sueros Glucosados 500ml', 'Solución de glucosa', 'insumo', 'Glucosa', '5%', 'Bolsa 500ml', 'Intravenosa', categoryIds[4], 90],
    ];
    
    const insertProducts = productosAdicionales.map(p => 
      `('${p[0]}', '${p[1]}', '${p[2]}', ${p[3] ? `'${p[3]}'` : 'NULL'}, ${p[4] ? `'${p[4]}'` : 'NULL'}, '${p[5]}', '${p[6]}', ${p[7]}, ${p[8]}, FALSE)`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO products (name, description, product_type, active_ingredient, concentration, presentation, administration_route, category_id, min_stock, requires_refrigeration)
      VALUES ${insertProducts}
    `);
    
    const [newProducts] = await connection.query('SELECT id FROM products ORDER BY id DESC LIMIT 50');
    const allProductIds = [...existingProductIds, ...newProducts.map(p => p.id)];
    
    console.log(`   ✓ ${productosAdicionales.length} productos adicionales insertados\n`);
    
    // ============================================================================
    // 2. INSERTAR MUCHOS LOTES
    // ============================================================================
    console.log('📝 [2/8] Insertando lotes masivos...');
    
    const lotes = [];
    const año = new Date().getFullYear();
    
    allProductIds.forEach((productId, idx) => {
      // 3-5 lotes por producto
      const numLotes = 3 + Math.floor(Math.random() * 3);
      
      for (let i = 1; i <= numLotes; i++) {
        const mesesVencimiento = 3 + Math.floor(Math.random() * 24); // 3-27 meses
        const diasIngreso = Math.floor(Math.random() * 180); // 0-180 días atrás
        const cantidad = 20 + Math.floor(Math.random() * 100); // 20-120 unidades
        const tieneRFID = Math.random() > 0.3; // 70% tienen RFID
        
        const fechaVencimiento = new Date();
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + mesesVencimiento);
        
        const fechaIngreso = new Date();
        fechaIngreso.setDate(fechaIngreso.getDate() - diasIngreso);
        
        const prefijo = ['LOT', 'BATCH', 'PROD', 'MED'][Math.floor(Math.random() * 4)];
        const numLote = idx * 10 + i;
        
        lotes.push([
          productId,
          generarLote(prefijo, año, numLote),
          fechaVencimiento.toISOString().split('T')[0],
          cantidad,
          fechaIngreso.toISOString().split('T')[0],
          tieneRFID ? generarRFID() : null
        ]);
      }
    });
    
    const insertLotes = lotes.map(l => 
      `(${l[0]}, '${l[1]}', '${l[2]}', ${l[3]}, '${l[4]}', ${l[5] ? `'${l[5]}'` : 'NULL'})`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO product_batches (product_id, lot_number, expiry_date, quantity, entry_date, rfid_uid)
      VALUES ${insertLotes}
    `);
    
    const [allBatches] = await connection.query('SELECT id, product_id FROM product_batches ORDER BY id');
    console.log(`   ✓ ${lotes.length} lotes insertados\n`);
    
    // ============================================================================
    // 3. INSERTAR HISTORIAL DE STOCK MASIVO
    // ============================================================================
    console.log('📝 [3/8] Insertando historial de stock...');
    
    const historial = [];
    const [batches] = await connection.query('SELECT id, product_id FROM product_batches LIMIT 200');
    
    batches.forEach((batch, idx) => {
      // 2-5 movimientos por lote
      const numMovimientos = 2 + Math.floor(Math.random() * 4);
      
      for (let i = 0; i < numMovimientos; i++) {
        const diasAtras = Math.floor(Math.random() * 90); // Últimos 90 días
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - diasAtras);
        
        const areaId = areaIds[Math.floor(Math.random() * areaIds.length)];
        const cantidadAnterior = 50 + Math.floor(Math.random() * 50);
        const cantidadNueva = Math.max(0, cantidadAnterior - (1 + Math.floor(Math.random() * 5)));
        
        historial.push([
          batch.product_id,
          batch.id,
          areaId,
          cantidadAnterior,
          cantidadNueva,
          'remove',
          fecha.toISOString().split('T')[0]
        ]);
      }
    });
    
    const insertHistorial = historial.map(h => 
      `(${h[0]}, ${h[1]}, ${h[2]}, ${h[3]}, ${h[4]}, '${h[5]}', '${h[6]}')`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO stock_history (product_id, batch_id, area_id, previous_stock, new_stock, action, consumption_date)
      VALUES ${insertHistorial}
    `);
    
    console.log(`   ✓ ${historial.length} registros de historial insertados\n`);
    
    // ============================================================================
    // 4. INSERTAR ALERTAS
    // ============================================================================
    console.log('📝 [4/8] Insertando alertas...');
    
    const alertas = [];
    
    // Alertas de stock bajo
    allProductIds.slice(0, 15).forEach(productId => {
      alertas.push([
        productId,
        null,
        'low_stock',
        ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        `Stock bajo para producto ID ${productId}`,
        Math.random() > 0.7, // 30% resueltas
        Math.random() > 0.7 ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
      ]);
    });
    
    // Alertas de productos próximos a vencer
    const [batchesProximos] = await connection.query(`
      SELECT id, product_id FROM product_batches 
      WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      LIMIT 20
    `);
    
    batchesProximos.forEach(batch => {
      alertas.push([
        batch.product_id,
        batch.id,
        'expiring_soon',
        'medium',
        `Lote próximo a vencer`,
        false,
        null
      ]);
    });
    
    const insertAlertas = alertas.map(a => 
      `(${a[0]}, ${a[1] ? a[1] : 'NULL'}, '${a[2]}', '${a[3]}', '${a[4]}', ${a[5] ? 1 : 0}, ${a[6] ? `'${a[6]}'` : 'NULL'})`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO stock_alerts (product_id, batch_id, alert_type, severity, message, is_resolved, resolved_at)
      VALUES ${insertAlertas}
    `);
    
    console.log(`   ✓ ${alertas.length} alertas insertadas\n`);
    
    // ============================================================================
    // 5. INSERTAR PREDICCIONES
    // ============================================================================
    console.log('📝 [5/8] Insertando predicciones de consumo...');
    
    const predicciones = [];
    const periodos = ['month', 'quarter', 'year'];
    
    allProductIds.slice(0, 30).forEach(productId => {
      const periodo = periodos[Math.floor(Math.random() * periodos.length)];
      const cantidadPredicha = 50 + Math.floor(Math.random() * 200);
      const confianza = 60 + Math.floor(Math.random() * 40); // 60-100%
      
      const fechaInicio = new Date();
      const fechaFin = new Date();
      
      if (periodo === 'month') {
        fechaFin.setMonth(fechaFin.getMonth() + 1);
      } else if (periodo === 'quarter') {
        fechaFin.setMonth(fechaFin.getMonth() + 3);
      } else {
        fechaFin.setFullYear(fechaFin.getFullYear() + 1);
      }
      
      const areaId = Math.random() > 0.5 ? areaIds[Math.floor(Math.random() * areaIds.length)] : null;
      
      predicciones.push([
        productId,
        areaId,
        periodo,
        cantidadPredicha,
        confianza,
        'moving_average',
        fechaInicio.toISOString().split('T')[0],
        fechaFin.toISOString().split('T')[0]
      ]);
    });
    
    const insertPredicciones = predicciones.map(p => 
      `(${p[0]}, ${p[1] ? p[1] : 'NULL'}, '${p[2]}', ${p[3]}, ${p[4]}, '${p[5]}', '${p[6]}', '${p[7]}')`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO consumption_predictions (product_id, area_id, prediction_period, predicted_quantity, confidence_level, algorithm_used, start_date, end_date)
      VALUES ${insertPredicciones}
    `);
    
    console.log(`   ✓ ${predicciones.length} predicciones insertadas\n`);
    
    // ============================================================================
    // 6. VERIFICAR/CREAR TABLA SUPPLIERS Y INSERTAR PROVEEDORES
    // ============================================================================
    console.log('📝 [6/8] Verificando tabla suppliers...');
    
    // Verificar si la tabla existe
    const [tables] = await connection.query("SHOW TABLES LIKE 'suppliers'");
    if (tables.length === 0) {
      console.log('   Creando tabla suppliers...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_name (name),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✓ Tabla suppliers creada');
    }
    
    console.log('   Insertando proveedores...');
    
    const proveedores = [
      ['Farmacéutica Nacional S.A.', 'contacto@farmanacional.com', '555-0101', 'Calle Principal 123', true],
      ['MedSupply Internacional', 'ventas@medsupply.com', '555-0102', 'Av. Industrial 456', true],
      ['Distribuidora Médica Central', 'info@dismed.com', '555-0103', 'Boulevard Médico 789', true],
      ['Farmacia Mayorista del Norte', 'pedidos@farmayorista.com', '555-0104', 'Zona Industrial Norte', true],
      ['Equipos Médicos Premium', 'comercial@equiposmed.com', '555-0105', 'Parque Tecnológico 321', true],
      ['Insumos Hospitalarios S.A.', 'contacto@insumoshosp.com', '555-0106', 'Polígono Industrial Sur', true],
      ['Farmacéutica del Sur', 'ventas@farmsur.com', '555-0107', 'Carretera Sur Km 15', true],
      ['Distribuidora Global Health', 'info@globalhealth.com', '555-0108', 'Centro Logístico Este', true],
    ];
    
    const insertProveedores = proveedores.map(p => 
      `('${p[0]}', '${p[1]}', '${p[2]}', '${p[3]}', ${p[4] ? 1 : 0})`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO suppliers (name, email, phone, address, is_active)
      VALUES ${insertProveedores}
    `);
    
    const [suppliers] = await connection.query('SELECT id FROM suppliers');
    console.log(`   ✓ ${proveedores.length} proveedores insertados\n`);
    
    // ============================================================================
    // 7. VERIFICAR/CREAR TABLA PURCHASE_ORDERS E INSERTAR ÓRDENES
    // ============================================================================
    console.log('📝 [7/8] Verificando tabla purchase_orders...');
    
    const [tablesOrders] = await connection.query("SHOW TABLES LIKE 'purchase_orders'");
    if (tablesOrders.length === 0) {
      console.log('   Creando tabla purchase_orders...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id INT PRIMARY KEY AUTO_INCREMENT,
          supplier_id INT NOT NULL,
          order_number VARCHAR(100) NOT NULL UNIQUE,
          order_date DATE NOT NULL,
          status ENUM('pending', 'approved', 'received', 'cancelled') DEFAULT 'pending',
          total_amount DECIMAL(10,2) DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
          INDEX idx_supplier (supplier_id),
          INDEX idx_status (status),
          INDEX idx_order_date (order_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✓ Tabla purchase_orders creada');
    }
    
    console.log('   Insertando órdenes de compra...');
    
    const ordenes = [];
    const estados = ['pending', 'approved', 'received', 'cancelled'];
    
    suppliers.forEach((supplier, idx) => {
      const numOrdenes = 2 + Math.floor(Math.random() * 4);
      
      for (let i = 0; i < numOrdenes; i++) {
        const diasAtras = Math.floor(Math.random() * 60);
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - diasAtras);
        
        const estado = estados[Math.floor(Math.random() * estados.length)];
        const total = 5000 + Math.floor(Math.random() * 50000);
        
        ordenes.push([
          supplier.id,
          `ORD-${año}-${String(idx * 10 + i + 1).padStart(4, '0')}`,
          fecha.toISOString().split('T')[0],
          estado,
          total
        ]);
      }
    });
    
    const insertOrdenes = ordenes.map(o => 
      `(${o[0]}, '${o[1]}', '${o[2]}', '${o[3]}', ${o[4]})`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO purchase_orders (supplier_id, order_number, order_date, status, total_amount)
      VALUES ${insertOrdenes}
    `);
    
    const [orders] = await connection.query('SELECT id, supplier_id FROM purchase_orders');
    console.log(`   ✓ ${ordenes.length} órdenes de compra insertadas\n`);
    
    // Verificar tabla purchase_order_items
    const [tablesItems] = await connection.query("SHOW TABLES LIKE 'purchase_order_items'");
    if (tablesItems.length === 0) {
      console.log('   Creando tabla purchase_order_items...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_order (order_id),
          INDEX idx_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✓ Tabla purchase_order_items creada');
    }
    
    // Insertar items de órdenes
    console.log('   Insertando items de órdenes...');
    const itemsOrdenes = [];
    
    orders.forEach(order => {
      const numItems = 3 + Math.floor(Math.random() * 5);
      const productosAleatorios = allProductIds.sort(() => 0.5 - Math.random()).slice(0, numItems);
      
      productosAleatorios.forEach(productId => {
        const cantidad = 10 + Math.floor(Math.random() * 50);
        const precio = 10 + Math.random() * 100;
        
        itemsOrdenes.push([
          order.id,
          productId,
          cantidad,
          precio,
          cantidad * precio
        ]);
      });
    });
    
    const insertItems = itemsOrdenes.map(i => 
      `(${i[0]}, ${i[1]}, ${i[2]}, ${i[3]}, ${i[4]})`
    ).join(',\n');
    
    await connection.query(`
      INSERT IGNORE INTO purchase_order_items (order_id, product_id, quantity, unit_price, total_price)
      VALUES ${insertItems}
    `);
    
    console.log(`   ✓ ${itemsOrdenes.length} items de órdenes insertados\n`);
    
    // ============================================================================
    // 8. VERIFICAR/CREAR TABLA RECEIPTS E INSERTAR RECEPCIONES
    // ============================================================================
    console.log('📝 [8/8] Verificando tabla receipts...');
    
    const [tablesReceipts] = await connection.query("SHOW TABLES LIKE 'receipts'");
    if (tablesReceipts.length === 0) {
      console.log('   Creando tabla receipts...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS receipts (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT NOT NULL,
          receipt_date DATE NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
          INDEX idx_order (order_id),
          INDEX idx_receipt_date (receipt_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✓ Tabla receipts creada');
    }
    
    console.log('   Insertando recepciones...');
    
    const recepciones = [];
    const [ordersReceived] = await connection.query("SELECT id FROM purchase_orders WHERE status = 'received' LIMIT 10");
    
    ordersReceived.forEach(order => {
      const diasAtras = Math.floor(Math.random() * 30);
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - diasAtras);
      
      recepciones.push([
        order.id,
        fecha.toISOString().split('T')[0],
        'Recepcionado completamente'
      ]);
    });
    
    const insertRecepciones = recepciones.map(r => 
      `(${r[0]}, '${r[1]}', '${r[2]}')`
    ).join(',\n');
    
    if (insertRecepciones) {
      await connection.query(`
        INSERT IGNORE INTO receipts (order_id, receipt_date, notes)
        VALUES ${insertRecepciones}
      `);
      console.log(`   ✓ ${recepciones.length} recepciones insertadas\n`);
    } else {
      console.log(`   ⚠️  No hay órdenes recibidas para crear recepciones\n`);
    }
    
    // ============================================================================
    // RESUMEN FINAL
    // ============================================================================
    console.log('📊 Resumen final de datos insertados:\n');
    
    const [finalCategories] = await connection.query('SELECT COUNT(*) as count FROM product_categories');
    const [finalProducts] = await connection.query('SELECT COUNT(*) as count FROM products');
    const [finalBatches] = await connection.query('SELECT COUNT(*) as count FROM product_batches');
    const [finalHistory] = await connection.query('SELECT COUNT(*) as count FROM stock_history');
    const [finalAlerts] = await connection.query('SELECT COUNT(*) as count FROM stock_alerts');
    const [finalPredictions] = await connection.query('SELECT COUNT(*) as count FROM consumption_predictions');
    const [finalSuppliers] = await connection.query('SELECT COUNT(*) as count FROM suppliers');
    const [finalOrders] = await connection.query('SELECT COUNT(*) as count FROM purchase_orders');
    const [finalReceipts] = await connection.query('SELECT COUNT(*) as count FROM receipts');
    const [finalAreas] = await connection.query('SELECT COUNT(*) as count FROM areas');
    
    console.log(`   ✅ Categorías: ${finalCategories[0].count}`);
    console.log(`   ✅ Productos: ${finalProducts[0].count}`);
    console.log(`   ✅ Lotes: ${finalBatches[0].count}`);
    console.log(`   ✅ Historial: ${finalHistory[0].count}`);
    console.log(`   ✅ Alertas: ${finalAlerts[0].count}`);
    console.log(`   ✅ Predicciones: ${finalPredictions[0].count}`);
    console.log(`   ✅ Proveedores: ${finalSuppliers[0].count}`);
    console.log(`   ✅ Órdenes de compra: ${finalOrders[0].count}`);
    console.log(`   ✅ Recepciones: ${finalReceipts[0].count}`);
    console.log(`   ✅ Áreas: ${finalAreas[0].count}\n`);
    
    console.log('🎉 Base de datos poblada masivamente con éxito!');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql.substring(0, 300));
    }
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

poblarDatosMasivos();

