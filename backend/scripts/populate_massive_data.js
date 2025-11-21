/**
 * Script MASIVO para poblar TODAS las tablas con datos realistas
 * Asegura que todos los productos tengan lotes con números de lote
 * 
 * Uso: node backend/scripts/populate_massive_data.js
 */

const db = require('../database_medical');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Función auxiliar para generar código aleatorio
function generateRandomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Función para generar fecha futura aleatoria
function generateFutureDate(minMonths = 6, maxMonths = 24) {
  const now = new Date();
  const months = minMonths + Math.floor(Math.random() * (maxMonths - minMonths));
  const futureDate = new Date(now);
  futureDate.setMonth(futureDate.getMonth() + months);
  return futureDate.toISOString().split('T')[0];
}

async function populateMassiveData() {
  let connection;
  
  try {
    // Intentar usar el pool primero, si falla usar conexión directa
    try {
      connection = await db.pool.getConnection();
      console.log('✓ Conectado usando pool de conexiones');
    } catch (poolError) {
      console.log('⚠ Pool no disponible, usando conexión directa...');
      try {
        connection = await mysql.createConnection({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
          database: process.env.DB_NAME || 'rfid_stock_db',
          multipleStatements: true
        });
        console.log('✓ Conectado a la base de datos');
      } catch (connError) {
        console.error('\n✗ ERROR: No se pudo conectar a la base de datos MySQL');
        console.error('   Por favor, asegúrate de que:');
        console.error('   1. MySQL está corriendo');
        console.error('   2. Las credenciales en .env son correctas');
        console.error('   3. La base de datos "rfid_stock_db" existe');
        console.error('\n   Alternativa: Ejecuta el script SQL directamente:');
        console.error('   mysql -u root -p rfid_stock_db < database/populate_massive_data.sql');
        throw connError;
      }
    }

    // ============================================================================
    // 1. CRÍTICO: Crear lotes para TODOS los productos con números de lote
    // ============================================================================
    console.log('\n📦 PASO 1: Creando lotes para TODOS los productos...');
    
    const [products] = await connection.execute('SELECT id, name, min_stock FROM products');
    console.log(`  Encontrados ${products.length} productos`);
    
    let batchesCreated = 0;
    let batchesUpdated = 0;
    
    for (const product of products) {
      // Verificar si el producto ya tiene lotes
      const [existingBatches] = await connection.execute(
        'SELECT id, lot_number FROM product_batches WHERE product_id = ?',
        [product.id]
      );
      
      if (existingBatches.length === 0) {
        // Crear un lote para este producto
        const lotNumber = `LOT-${String(product.id).padStart(6, '0')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const rfidUid = Math.random() > 0.3 ? `PROD-${String(product.id).padStart(8, '0')}-${generateRandomCode(4)}` : null;
        const expiryDate = generateFutureDate(6, 24);
        const quantity = (product.min_stock || 10) * (5 + Math.floor(Math.random() * 10)); // 5-15x el min_stock
        
        await connection.execute(
          `INSERT INTO product_batches 
           (product_id, lot_number, rfid_uid, expiry_date, quantity, entry_date, created_at) 
           VALUES (?, ?, ?, ?, ?, CURDATE(), NOW())`,
          [product.id, lotNumber, rfidUid, expiryDate, quantity]
        );
        batchesCreated++;
      } else {
        // Verificar que TODOS los lotes tengan número de lote
        for (const batch of existingBatches) {
          if (!batch.lot_number || batch.lot_number === '' || batch.lot_number === null) {
            const lotNumber = `LOT-${String(product.id).padStart(6, '0')}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
            await connection.execute(
              'UPDATE product_batches SET lot_number = ? WHERE id = ?',
              [lotNumber, batch.id]
            );
            batchesUpdated++;
          }
        }
      }
    }
    
    console.log(`✅ ${batchesCreated} lotes creados, ${batchesUpdated} lotes actualizados con números de lote`);

    // ============================================================================
    // 2. POBLAR SUPPLIERS (Proveedores) - MÁS DATOS
    // ============================================================================
    console.log('\n🏢 PASO 2: Poblando proveedores...');
    
    const [supplierCount] = await connection.execute('SELECT COUNT(*) as count FROM suppliers');
    const currentCount = supplierCount[0].count;
    
    if (currentCount < 20) {
      const suppliers = [
        { name: 'Farmacéutica Nacional S.A.', contact: 'Juan Pérez', email: 'contacto@farmanacional.com', phone: '01-234-5678', address: 'Av. Principal 123, Lima', tax_id: '20123456789' },
        { name: 'Medicamentos del Perú S.A.C.', contact: 'María González', email: 'ventas@medperu.com', phone: '01-345-6789', address: 'Jr. Los Olivos 456, Lima', tax_id: '20234567890' },
        { name: 'Distribuidora Médica Integral', contact: 'Carlos Ramírez', email: 'info@dmi.com.pe', phone: '01-456-7890', address: 'Av. Libertad 789, Lima', tax_id: '20345678901' },
        { name: 'Insumos Médicos Premium', contact: 'Ana López', email: 'contacto@insumospremium.com', phone: '01-567-8901', address: 'Calle Real 321, Lima', tax_id: '20456789012' },
        { name: 'Farmacéutica Internacional', contact: 'Roberto Sánchez', email: 'ventas@farmainternacional.com', phone: '01-678-9012', address: 'Av. San Martín 654, Lima', tax_id: '20567890123' },
        { name: 'Equipos Médicos Especializados', contact: 'Laura Torres', email: 'info@equiposmedicos.com', phone: '01-789-0123', address: 'Jr. Unión 987, Lima', tax_id: '20678901234' },
        { name: 'Laboratorios Farmacéuticos Unidos', contact: 'Miguel Vásquez', email: 'contacto@labunidos.com', phone: '01-890-1234', address: 'Av. Progreso 147, Lima', tax_id: '20789012345' },
        { name: 'Distribuidora de Medicamentos Genericos', contact: 'Carmen Castro', email: 'ventas@medgenericos.com', phone: '01-901-2345', address: 'Calle Bolívar 258, Lima', tax_id: '20890123456' },
        { name: 'Insumos Hospitalarios S.A.', contact: 'Fernando Morales', email: 'info@insumoshospital.com', phone: '01-012-3456', address: 'Av. América 369, Lima', tax_id: '20901234567' },
        { name: 'Farmacéutica Andina', contact: 'Patricia Jiménez', email: 'contacto@farmaandina.com', phone: '01-123-4567', address: 'Jr. Independencia 741, Lima', tax_id: '20112345678' },
        { name: 'Medicamentos Especializados S.A.', contact: 'Luis Ramírez', email: 'ventas@medespecializados.com', phone: '01-234-5678', address: 'Av. Central 852, Lima', tax_id: '20123456789' },
        { name: 'Distribuidora Farmacéutica del Sur', contact: 'Rosa Jiménez', email: 'info@farmasur.com', phone: '01-345-6789', address: 'Calle Principal 963, Lima', tax_id: '20134567890' },
        { name: 'Laboratorios Nacionales', contact: 'Jorge Mendoza', email: 'contacto@labnacional.com', phone: '01-456-7890', address: 'Av. Los Héroes 159, Lima', tax_id: '20145678901' },
        { name: 'Insumos Quirúrgicos Premium', contact: 'Silvia Rojas', email: 'ventas@insumosquirurgicos.com', phone: '01-567-8901', address: 'Jr. La Paz 357, Lima', tax_id: '20156789012' },
        { name: 'Farmacéutica del Pacífico', contact: 'Ricardo Flores', email: 'info@farmapacifico.com', phone: '01-678-9012', address: 'Av. La Victoria 468, Lima', tax_id: '20167890123' }
      ];
      
      // Insertar solo los que faltan
      for (const supplier of suppliers.slice(currentCount)) {
        try {
          await connection.execute(
            `INSERT INTO suppliers (name, contact_person, email, phone, address, tax_id, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [supplier.name, supplier.contact, supplier.email, supplier.phone, supplier.address, supplier.tax_id, true]
          );
        } catch (e) {
          // Ignorar duplicados
        }
      }
      console.log(`✅ ${Math.min(suppliers.length - currentCount, suppliers.length)} proveedores insertados`);
    } else {
      console.log(`✅ Proveedores ya tienen datos (${currentCount} registros)`);
    }

    // ============================================================================
    // 3. POBLAR PURCHASE_ORDERS (Órdenes de Compra) - MÁS DATOS
    // ============================================================================
    console.log('\n📋 PASO 3: Poblando órdenes de compra...');
    
    const [orderCount] = await connection.execute('SELECT COUNT(*) as count FROM purchase_orders');
    const currentOrderCount = orderCount[0].count;
    
    if (currentOrderCount < 30) {
      const [suppliers] = await connection.execute('SELECT id FROM suppliers LIMIT 15');
      const [users] = await connection.execute('SELECT id FROM users WHERE role IN ("admin", "farmaceutico_jefe", "farmaceutico") LIMIT 5');
      const userId = users.length > 0 ? users[0].id : null;
      
      if (suppliers.length > 0) {
        const statuses = ['pending', 'approved', 'ordered', 'received'];
        const today = new Date();
        const ordersToCreate = 30 - currentOrderCount;
        
        for (let i = 0; i < ordersToCreate; i++) {
          const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
          const orderDate = new Date(today);
          orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 180)); // Últimos 180 días
          const orderNumber = `OC-${new Date().getFullYear()}-${String(currentOrderCount + i + 1).padStart(4, '0')}`;
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          
          // Verificar si la columna created_by existe
          const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'purchase_orders' 
            AND COLUMN_NAME = 'created_by'
          `);
          
          const hasCreatedBy = columns.length > 0;
          const insertFields = hasCreatedBy 
            ? '(supplier_id, order_number, order_date, status, total_amount, created_by)'
            : '(supplier_id, order_number, order_date, status, total_amount)';
          const insertValues = hasCreatedBy 
            ? [supplier.id, orderNumber, orderDate.toISOString().split('T')[0], status, userId]
            : [supplier.id, orderNumber, orderDate.toISOString().split('T')[0], status];
          
          const [result] = await connection.execute(
            `INSERT INTO purchase_orders ${insertFields} VALUES (?, ?, ?, ?, ${hasCreatedBy ? '0, ?' : '0'})`,
            insertValues
          );
          
          // Crear items para esta orden (2-5 productos)
          const [orderProducts] = await connection.execute('SELECT id FROM products ORDER BY RAND() LIMIT ' + (2 + Math.floor(Math.random() * 4)));
          let orderTotal = 0;
          
          for (const product of orderProducts) {
            const quantity = 10 + Math.floor(Math.random() * 90);
            const unitPrice = (10 + Math.random() * 90).toFixed(2);
            const totalPrice = (quantity * parseFloat(unitPrice)).toFixed(2);
            orderTotal += parseFloat(totalPrice);
            
            await connection.execute(
              `INSERT INTO purchase_order_items 
               (order_id, product_id, quantity, unit_price, total_price) 
               VALUES (?, ?, ?, ?, ?)`,
              [result.insertId, product.id, quantity, unitPrice, totalPrice]
            );
          }
          
          // Actualizar total de la orden
          await connection.execute(
            'UPDATE purchase_orders SET total_amount = ? WHERE id = ?',
            [orderTotal.toFixed(2), result.insertId]
          );
        }
        console.log(`✅ ${ordersToCreate} órdenes de compra con items insertadas`);
      }
    } else {
      console.log(`✅ Órdenes de compra ya tienen datos (${currentOrderCount} registros)`);
    }

    // ============================================================================
    // 4. POBLAR PRESCRIPTIONS (Recetas) - MÁS DATOS
    // ============================================================================
    console.log('\n💊 PASO 4: Poblando recetas médicas...');
    
    // Verificar si la tabla existe
    const [prescriptionTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'prescriptions'
    `);
    
    if (prescriptionTable[0].count === 0) {
      console.log('⚠️  Tabla prescriptions no existe, saltando...');
    } else {
      const [prescriptionCount] = await connection.execute('SELECT COUNT(*) as count FROM prescriptions');
      const currentPrescriptionCount = prescriptionCount[0].count;
      
      if (currentPrescriptionCount < 50) {
        const [doctors] = await connection.execute('SELECT id, name, license_number FROM doctors LIMIT 15');
        const [patients] = await connection.execute('SELECT id, name, id_number FROM patients LIMIT 15');
        const [users] = await connection.execute('SELECT id FROM users LIMIT 3');
        const userId = users.length > 0 ? users[0].id : null;
        
        if (doctors.length > 0 && patients.length > 0) {
        const statuses = ['pending', 'partial', 'fulfilled'];
        const today = new Date();
        const prescriptionsToCreate = 50 - currentPrescriptionCount;
        
        for (let i = 0; i < prescriptionsToCreate; i++) {
          const doctor = doctors[Math.floor(Math.random() * doctors.length)];
          const patient = patients[Math.floor(Math.random() * patients.length)];
          const prescriptionDate = new Date(today);
          prescriptionDate.setDate(prescriptionDate.getDate() - Math.floor(Math.random() * 60)); // Últimos 60 días
          const prescriptionCode = `REC-${new Date().getFullYear()}-${String(currentPrescriptionCount + i + 1).padStart(4, '0')}`;
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          
          // Verificar qué columnas existen en prescriptions
          const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'prescriptions'
          `);
          
          const columnMap = {};
          columns.forEach(c => { columnMap[c.COLUMN_NAME] = c.DATA_TYPE; });
          
          let insertFields = ['prescription_code', 'patient_name', 'doctor_name', 'prescription_date', 'status'];
          let insertValues = [prescriptionCode, patient.name, doctor.name, prescriptionDate.toISOString().split('T')[0], status];
          
          if (columnMap['patient_id_number']) {
            insertFields.push('patient_id_number');
            insertValues.push(patient.id_number);
          } else if (columnMap['patient_id'] === 'varchar') {
            insertFields.push('patient_id');
            insertValues.push(patient.id_number);
          }
          
          if (columnMap['patient_id'] === 'int') {
            insertFields.push('patient_id');
            insertValues.push(patient.id);
          }
          
          if (columnMap['doctor_id']) {
            insertFields.push('doctor_id');
            insertValues.push(doctor.id);
          }
          
          if (columnMap['doctor_license']) {
            insertFields.push('doctor_license');
            insertValues.push(doctor.license_number);
          }
          
          if (userId && columnMap['created_by']) {
            insertFields.push('created_by');
            insertValues.push(userId);
          }
          
          const placeholders = insertFields.map(() => '?').join(', ');
          const [result] = await connection.execute(
            `INSERT INTO prescriptions (${insertFields.join(', ')}) VALUES (${placeholders})`,
            insertValues
          );
          
          // Crear items para esta receta (1-3 medicamentos)
          const [prescriptionProducts] = await connection.execute('SELECT id FROM products WHERE product_type = "medicamento" ORDER BY RAND() LIMIT ' + (1 + Math.floor(Math.random() * 3)));
          
          for (const product of prescriptionProducts) {
            const quantityRequired = 1 + Math.floor(Math.random() * 3);
            const instructions = ['1 tableta cada 8 horas', '1 tableta cada 12 horas', '1 tableta cada 6 horas', '2 tabletas al día', '1 tableta antes de las comidas'][Math.floor(Math.random() * 5)];
            const quantityDispensed = status === 'fulfilled' ? quantityRequired : (status === 'partial' ? Math.floor(quantityRequired / 2) : 0);
            
            await connection.execute(
              `INSERT INTO prescription_items 
               (prescription_id, product_id, quantity_required, quantity_dispensed, instructions) 
               VALUES (?, ?, ?, ?, ?)`,
              [result.insertId, product.id, quantityRequired, quantityDispensed, instructions]
            );
          }
        }
          console.log(`✅ ${prescriptionsToCreate} recetas médicas con items insertadas`);
        } else {
          console.log(`✅ Recetas ya tienen datos (${currentPrescriptionCount} registros)`);
        }
      }
    }

    // ============================================================================
    // 5. POBLAR PERMISSIONS (Permisos)
    // ============================================================================
    console.log('\n🔐 PASO 5: Poblando permisos...');
    
    // Verificar si la tabla existe
    const [permissionTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'permissions'
    `);
    
    if (permissionTable[0].count === 0) {
      console.log('⚠️  Tabla permissions no existe, saltando...');
    } else {
      const [permissionCount] = await connection.execute('SELECT COUNT(*) as count FROM permissions');
    if (permissionCount[0].count === 0) {
      const permissions = [
        { name: 'products.create', description: 'Crear productos' },
        { name: 'products.update', description: 'Actualizar productos' },
        { name: 'products.delete', description: 'Eliminar productos' },
        { name: 'products.view', description: 'Ver productos' },
        { name: 'prescriptions.create', description: 'Crear recetas' },
        { name: 'prescriptions.update', description: 'Actualizar recetas' },
        { name: 'prescriptions.delete', description: 'Eliminar recetas' },
        { name: 'prescriptions.view', description: 'Ver recetas' },
        { name: 'stock.entry', description: 'Registrar entrada de stock' },
        { name: 'stock.exit', description: 'Registrar salida de stock' },
        { name: 'users.manage', description: 'Gestionar usuarios' },
        { name: 'reports.view', description: 'Ver reportes' },
        { name: 'reports.generate', description: 'Generar reportes' },
        { name: 'admin.access', description: 'Acceso a panel de administración' }
      ];
      
      for (const perm of permissions) {
        try {
          await connection.execute(
            'INSERT INTO permissions (name, description) VALUES (?, ?)',
            [perm.name, perm.description]
          );
        } catch (e) {
          // Ignorar duplicados
        }
      }
        console.log(`✅ ${permissions.length} permisos insertados`);
      } else {
        console.log(`✅ Permisos ya tienen datos (${permissionCount[0].count} registros)`);
      }
    }

    // ============================================================================
    // 6. POBLAR ROLE_PERMISSIONS
    // ============================================================================
    console.log('\n👥 PASO 6: Asignando permisos a roles...');
    
    // Verificar si la tabla existe
    const [rolePermTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'role_permissions'
    `);
    
    if (rolePermTable[0].count === 0) {
      console.log('⚠️  Tabla role_permissions no existe, saltando...');
    } else {
      const [rolePermCount] = await connection.execute('SELECT COUNT(*) as count FROM role_permissions');
    if (rolePermCount[0].count === 0) {
      const [permissions] = await connection.execute('SELECT id, name FROM permissions');
      const permMap = {};
      permissions.forEach(p => { permMap[p.name] = p.id; });
      
      // Admin: todos los permisos
      for (const perm of permissions) {
        try {
          await connection.execute(
            'INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)',
            ['admin', perm.id]
          );
        } catch (e) {}
      }
      
      // Farmaceutico: permisos de productos, recetas y stock
      const farmaceuticoPerms = [
        'products.view', 'products.create', 'products.update',
        'prescriptions.view', 'prescriptions.create', 'prescriptions.update',
        'stock.entry', 'stock.exit', 'reports.view'
      ];
      for (const permName of farmaceuticoPerms) {
        if (permMap[permName]) {
          try {
            await connection.execute(
              'INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)',
              ['farmaceutico', permMap[permName]]
            );
          } catch (e) {}
        }
      }
      
        console.log('✅ Permisos asignados a roles');
      } else {
        console.log(`✅ Permisos de roles ya tienen datos (${rolePermCount[0].count} registros)`);
      }
    }

    // ============================================================================
    // 7. POBLAR SYSTEM_CONFIG
    // ============================================================================
    console.log('\n⚙️ PASO 7: Poblando configuraciones del sistema...');
    
    // Verificar si la tabla existe
    const [configTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'system_config'
    `);
    
    if (configTable[0].count === 0) {
      console.log('⚠️  Tabla system_config no existe, saltando...');
    } else {
      const [configCount] = await connection.execute('SELECT COUNT(*) as count FROM system_config');
    if (configCount[0].count === 0) {
      const configs = [
        { key: 'stock.alert_threshold', value: '10', type: 'number', description: 'Umbral mínimo para alertas de stock', category: 'alerts' },
        { key: 'stock.expiry_warning_days', value: '30', type: 'number', description: 'Días antes del vencimiento para alertar', category: 'alerts' },
        { key: 'system.name', value: 'Sistema Hospitalario de Gestión', type: 'string', description: 'Nombre del sistema', category: 'general' },
        { key: 'notifications.email_enabled', value: 'true', type: 'boolean', description: 'Habilitar notificaciones por email', category: 'notifications' },
        { key: 'reports.default_format', value: 'pdf', type: 'string', description: 'Formato por defecto para reportes', category: 'reports' }
      ];
      
      for (const config of configs) {
        try {
          await connection.execute(
            `INSERT INTO system_config (config_key, config_value, config_type, description, category) 
             VALUES (?, ?, ?, ?, ?)`,
            [config.key, config.value, config.type, config.description, config.category]
          );
        } catch (e) {}
      }
        console.log(`✅ ${configs.length} configuraciones insertadas`);
      } else {
        console.log(`✅ Configuraciones ya tienen datos (${configCount[0].count} registros)`);
      }
    }

    // ============================================================================
    // 8. POBLAR STOCK_HISTORY - MÁS DATOS
    // ============================================================================
    console.log('\n📊 PASO 8: Poblando historial de stock...');
    
    // Verificar si la tabla existe
    const [historyTable] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'stock_history'
    `);
    
    if (historyTable[0].count === 0) {
      console.log('⚠️  Tabla stock_history no existe, saltando...');
    } else {
      const [historyCount] = await connection.execute('SELECT COUNT(*) as count FROM stock_history');
      const currentHistoryCount = historyCount[0].count;
      
      if (currentHistoryCount < 100) {
        const [batches] = await connection.execute('SELECT id, product_id FROM product_batches LIMIT 50');
        const [users] = await connection.execute('SELECT id FROM users LIMIT 5');
        const [areas] = await connection.execute('SELECT id FROM areas LIMIT 8');
        
        if (batches.length > 0 && users.length > 0 && areas.length > 0) {
        const today = new Date();
        const historyToCreate = 100 - currentHistoryCount;
        
        for (let i = 0; i < historyToCreate; i++) {
          const batch = batches[Math.floor(Math.random() * batches.length)];
          const user = users[Math.floor(Math.random() * users.length)];
          const area = areas[Math.floor(Math.random() * areas.length)];
          const movementDate = new Date(today);
          movementDate.setDate(movementDate.getDate() - Math.floor(Math.random() * 90)); // Últimos 90 días
          const movementType = Math.random() > 0.5 ? 'entry' : 'exit';
          const quantity = 1 + Math.floor(Math.random() * 20);
          
          try {
            await connection.execute(
              `INSERT INTO stock_history 
               (product_id, batch_id, area_id, movement_type, quantity, notes, created_by, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                batch.product_id,
                batch.id,
                area.id,
                movementType,
                quantity,
                `Movimiento ${movementType === 'entry' ? 'de entrada' : 'de salida'} generado automáticamente`,
                user.id,
                movementDate.toISOString().slice(0, 19).replace('T', ' ')
              ]
            );
          } catch (e) {
            // Ignorar errores
          }
        }
          console.log(`✅ ${historyToCreate} registros de historial de stock insertados`);
        } else {
          console.log(`✅ Historial de stock ya tiene datos (${currentHistoryCount} registros)`);
        }
      }
    }

    // ============================================================================
    // RESUMEN FINAL
    // ============================================================================
    console.log('\n✅ Población masiva de datos completada exitosamente');
    console.log('\n📊 Resumen final:');
    
    // Construir resumen solo para tablas que existen
    const stats = [];
    
    // Tablas que siempre deberían existir
    try {
      const [productsCount] = await connection.execute('SELECT COUNT(*) as total FROM products');
      stats.push({ tabla: 'Productos', total: productsCount[0].total });
    } catch (e) {}
    
    try {
      const [batchesCount] = await connection.execute('SELECT COUNT(*) as total FROM product_batches');
      stats.push({ tabla: 'Lotes', total: batchesCount[0].total });
      
      const [batchesWithLot] = await connection.execute('SELECT COUNT(*) as total FROM product_batches WHERE lot_number IS NOT NULL AND lot_number != ""');
      stats.push({ tabla: 'Lotes con número', total: batchesWithLot[0].total });
    } catch (e) {}
    
    try {
      const [suppliersCount] = await connection.execute('SELECT COUNT(*) as total FROM suppliers');
      stats.push({ tabla: 'Proveedores', total: suppliersCount[0].total });
    } catch (e) {}
    
    try {
      const [ordersCount] = await connection.execute('SELECT COUNT(*) as total FROM purchase_orders');
      stats.push({ tabla: 'Órdenes de Compra', total: ordersCount[0].total });
    } catch (e) {}
    
    try {
      const [orderItemsCount] = await connection.execute('SELECT COUNT(*) as total FROM purchase_order_items');
      stats.push({ tabla: 'Items de Órdenes', total: orderItemsCount[0].total });
    } catch (e) {}
    
    try {
      const [prescriptionsCount] = await connection.execute('SELECT COUNT(*) as total FROM prescriptions');
      stats.push({ tabla: 'Recetas', total: prescriptionsCount[0].total });
    } catch (e) {}
    
    try {
      const [prescriptionItemsCount] = await connection.execute('SELECT COUNT(*) as total FROM prescription_items');
      stats.push({ tabla: 'Items de Receta', total: prescriptionItemsCount[0].total });
    } catch (e) {}
    
    try {
      const [permissionsCount] = await connection.execute('SELECT COUNT(*) as total FROM permissions');
      stats.push({ tabla: 'Permisos', total: permissionsCount[0].total });
    } catch (e) {}
    
    try {
      const [configCount] = await connection.execute('SELECT COUNT(*) as total FROM system_config');
      stats.push({ tabla: 'Configuraciones', total: configCount[0].total });
    } catch (e) {}
    
    try {
      const [historyCount] = await connection.execute('SELECT COUNT(*) as total FROM stock_history');
      stats.push({ tabla: 'Historial de Stock', total: historyCount[0].total });
    } catch (e) {}
    
    stats.forEach(stat => {
      console.log(`  ${stat.tabla}: ${stat.total}`);
    });

    // Verificar que todos los productos tengan lotes
    const [productsWithoutBatches] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM products p 
      LEFT JOIN product_batches pb ON pb.product_id = p.id 
      WHERE pb.id IS NULL
    `);
    
    if (productsWithoutBatches[0].count > 0) {
      console.log(`\n⚠️  ADVERTENCIA: ${productsWithoutBatches[0].count} productos aún no tienen lotes`);
    } else {
      console.log(`\n✅ Todos los productos tienen al menos un lote`);
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    if (connection && connection.release) {
      connection.release();
    } else if (connection && connection.end) {
      await connection.end();
    }
    console.log('\n✓ Conexión cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  populateMassiveData()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error al ejecutar el script:', error);
      process.exit(1);
    });
}

module.exports = { populateMassiveData };

