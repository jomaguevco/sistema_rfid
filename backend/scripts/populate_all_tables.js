/**
 * Script completo para poblar todas las tablas vacías con datos realistas
 * Asegura que todos los productos tengan lotes con números de lote
 */

const mysql = require('mysql2/promise');
const { hashPassword } = require('../utils/password');
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

async function populateAllTables() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
      database: process.env.DB_NAME || 'rfid_stock_db',
      multipleStatements: true
    });

    console.log('✓ Conectado a la base de datos');

    // ============================================================================
    // 1. VERIFICAR Y POBLAR PRODUCT_BATCHES (CRÍTICO: Todos los productos deben tener lotes)
    // ============================================================================
    console.log('\n📦 Verificando y creando lotes para productos...');
    
    const [products] = await connection.execute('SELECT id, name FROM products');
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
        const quantity = 50 + Math.floor(Math.random() * 450); // 50-500 unidades
        
        await connection.execute(
          `INSERT INTO product_batches 
           (product_id, lot_number, rfid_uid, expiry_date, quantity, created_at) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [product.id, lotNumber, rfidUid, expiryDate, quantity]
        );
        batchesCreated++;
      } else {
        // Verificar que el lote tenga número de lote
        for (const batch of existingBatches) {
          if (!batch.lot_number || batch.lot_number === '') {
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
    
    console.log(`✓ ${batchesCreated} lotes creados, ${batchesUpdated} lotes actualizados`);

    // ============================================================================
    // 2. POBLAR SUPPLIERS (Proveedores)
    // ============================================================================
    console.log('\n🏢 Poblando proveedores...');
    
    const [supplierCount] = await connection.execute('SELECT COUNT(*) as count FROM suppliers');
    if (supplierCount[0].count === 0) {
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
        { name: 'Farmacéutica Andina', contact: 'Patricia Jiménez', email: 'contacto@farmaandina.com', phone: '01-123-4567', address: 'Jr. Independencia 741, Lima', tax_id: '20112345678' }
      ];
      
      for (const supplier of suppliers) {
        await connection.execute(
          `INSERT INTO suppliers (name, contact_person, email, phone, address, tax_id, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [supplier.name, supplier.contact, supplier.email, supplier.phone, supplier.address, supplier.tax_id, true]
        );
      }
      console.log(`✓ ${suppliers.length} proveedores insertados`);
    } else {
      console.log(`✓ Proveedores ya existen (${supplierCount[0].count} registros)`);
    }

    // ============================================================================
    // 3. POBLAR PURCHASE_ORDERS (Órdenes de Compra)
    // ============================================================================
    console.log('\n📋 Poblando órdenes de compra...');
    
    const [orderCount] = await connection.execute('SELECT COUNT(*) as count FROM purchase_orders');
    if (orderCount[0].count === 0) {
      const [suppliers] = await connection.execute('SELECT id FROM suppliers LIMIT 10');
      const [users] = await connection.execute('SELECT id FROM users WHERE role = "admin" OR role = "farmaceutico_jefe" LIMIT 1');
      const userId = users.length > 0 ? users[0].id : null;
      
      if (suppliers.length > 0) {
        const statuses = ['pending', 'approved', 'ordered', 'received'];
        const today = new Date();
        
        for (let i = 0; i < 8; i++) {
          const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
          const orderDate = new Date(today);
          orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 90)); // Últimos 90 días
          const orderNumber = `OC-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`;
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const totalAmount = (1000 + Math.random() * 9000).toFixed(2);
          
          const [result] = await connection.execute(
            `INSERT INTO purchase_orders 
             (supplier_id, order_number, order_date, status, total_amount, created_by) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [supplier.id, orderNumber, orderDate.toISOString().split('T')[0], status, totalAmount, userId]
          );
          
          // Crear items para esta orden
          const [orderProducts] = await connection.execute('SELECT id FROM products ORDER BY RAND() LIMIT 3');
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
        console.log('✓ 8 órdenes de compra con items insertadas');
      }
    } else {
      console.log(`✓ Órdenes de compra ya existen (${orderCount[0].count} registros)`);
    }

    // ============================================================================
    // 4. POBLAR PRESCRIPTIONS (Recetas)
    // ============================================================================
    console.log('\n💊 Poblando recetas médicas...');
    
    const [prescriptionCount] = await connection.execute('SELECT COUNT(*) as count FROM prescriptions');
    if (prescriptionCount[0].count === 0) {
      const [doctors] = await connection.execute('SELECT id, name, license_number FROM doctors LIMIT 10');
      const [patients] = await connection.execute('SELECT id, name, id_number FROM patients LIMIT 10');
      const [users] = await connection.execute('SELECT id FROM users LIMIT 1');
      const userId = users.length > 0 ? users[0].id : null;
      
      if (doctors.length > 0 && patients.length > 0) {
        const statuses = ['pending', 'partial', 'fulfilled'];
        const today = new Date();
        
        for (let i = 0; i < 15; i++) {
          const doctor = doctors[Math.floor(Math.random() * doctors.length)];
          const patient = patients[Math.floor(Math.random() * patients.length)];
          const prescriptionDate = new Date(today);
          prescriptionDate.setDate(prescriptionDate.getDate() - Math.floor(Math.random() * 30)); // Últimos 30 días
          const prescriptionCode = `REC-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`;
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          
          const [result] = await connection.execute(
            `INSERT INTO prescriptions 
             (prescription_code, patient_name, patient_id, patient_id_number, doctor_name, doctor_license, doctor_id, prescription_date, status, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              prescriptionCode,
              patient.name,
              patient.id,
              patient.id_number,
              doctor.name,
              doctor.license_number,
              doctor.id,
              prescriptionDate.toISOString().split('T')[0],
              status,
              userId
            ]
          );
          
          // Crear items para esta receta
          const [prescriptionProducts] = await connection.execute('SELECT id FROM products WHERE product_type = "medicamento" ORDER BY RAND() LIMIT 2');
          
          for (const product of prescriptionProducts) {
            const quantityRequired = 1 + Math.floor(Math.random() * 3);
            const instructions = ['1 tableta cada 8 horas', '1 tableta cada 12 horas', '1 tableta cada 6 horas', '2 tabletas al día'][Math.floor(Math.random() * 4)];
            const quantityDispensed = status === 'fulfilled' ? quantityRequired : (status === 'partial' ? Math.floor(quantityRequired / 2) : 0);
            
            await connection.execute(
              `INSERT INTO prescription_items 
               (prescription_id, product_id, quantity_required, quantity_dispensed, instructions) 
               VALUES (?, ?, ?, ?, ?)`,
              [result.insertId, product.id, quantityRequired, quantityDispensed, instructions]
            );
          }
        }
        console.log('✓ 15 recetas médicas con items insertadas');
      }
    } else {
      console.log(`✓ Recetas ya existen (${prescriptionCount[0].count} registros)`);
    }

    // ============================================================================
    // 5. POBLAR PERMISSIONS (Permisos)
    // ============================================================================
    console.log('\n🔐 Poblando permisos...');
    
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
        await connection.execute(
          'INSERT INTO permissions (name, description) VALUES (?, ?)',
          [perm.name, perm.description]
        );
      }
      console.log(`✓ ${permissions.length} permisos insertados`);
    } else {
      console.log(`✓ Permisos ya existen (${permissionCount[0].count} registros)`);
    }

    // ============================================================================
    // 6. POBLAR ROLE_PERMISSIONS (Asignar permisos a roles)
    // ============================================================================
    console.log('\n👥 Asignando permisos a roles...');
    
    const [rolePermCount] = await connection.execute('SELECT COUNT(*) as count FROM role_permissions');
    if (rolePermCount[0].count === 0) {
      const [permissions] = await connection.execute('SELECT id, name FROM permissions');
      const permMap = {};
      permissions.forEach(p => { permMap[p.name] = p.id; });
      
      // Admin: todos los permisos
      for (const perm of permissions) {
        await connection.execute(
          'INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)',
          ['admin', perm.id]
        );
      }
      
      // Farmaceutico: permisos de productos, recetas y stock
      const farmaceuticoPerms = [
        'products.view', 'products.create', 'products.update',
        'prescriptions.view', 'prescriptions.create', 'prescriptions.update',
        'stock.entry', 'stock.exit', 'reports.view'
      ];
      for (const permName of farmaceuticoPerms) {
        if (permMap[permName]) {
          await connection.execute(
            'INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)',
            ['farmaceutico', permMap[permName]]
          );
        }
      }
      
      console.log('✓ Permisos asignados a roles');
    } else {
      console.log(`✓ Permisos de roles ya existen (${rolePermCount[0].count} registros)`);
    }

    // ============================================================================
    // 7. POBLAR SYSTEM_CONFIG (Configuraciones)
    // ============================================================================
    console.log('\n⚙️ Poblando configuraciones del sistema...');
    
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
        await connection.execute(
          `INSERT INTO system_config (config_key, config_value, config_type, description, category) 
           VALUES (?, ?, ?, ?, ?)`,
          [config.key, config.value, config.type, config.description, config.category]
        );
      }
      console.log(`✓ ${configs.length} configuraciones insertadas`);
    } else {
      console.log(`✓ Configuraciones ya existen (${configCount[0].count} registros)`);
    }

    // ============================================================================
    // 8. POBLAR STOCK_HISTORY (Historial de Stock)
    // ============================================================================
    console.log('\n📊 Poblando historial de stock...');
    
    const [historyCount] = await connection.execute('SELECT COUNT(*) as count FROM stock_history');
    if (historyCount[0].count === 0) {
      const [batches] = await connection.execute('SELECT id, product_id FROM product_batches LIMIT 20');
      const [users] = await connection.execute('SELECT id FROM users LIMIT 3');
      const [areas] = await connection.execute('SELECT id FROM areas LIMIT 6');
      
      if (batches.length > 0 && users.length > 0 && areas.length > 0) {
        const today = new Date();
        
        for (let i = 0; i < 30; i++) {
          const batch = batches[Math.floor(Math.random() * batches.length)];
          const user = users[Math.floor(Math.random() * users.length)];
          const area = areas[Math.floor(Math.random() * areas.length)];
          const movementDate = new Date(today);
          movementDate.setDate(movementDate.getDate() - Math.floor(Math.random() * 60)); // Últimos 60 días
          const movementType = Math.random() > 0.5 ? 'entry' : 'exit';
          const quantity = 1 + Math.floor(Math.random() * 10);
          
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
        }
        console.log('✓ 30 registros de historial de stock insertados');
      }
    } else {
      console.log(`✓ Historial de stock ya existe (${historyCount[0].count} registros)`);
    }

    // ============================================================================
    // RESUMEN FINAL
    // ============================================================================
    console.log('\n✅ Población de datos completada exitosamente');
    console.log('\n📊 Resumen:');
    const [stats] = await connection.execute(`
      SELECT 'Productos' as tabla, COUNT(*) as total FROM products
      UNION ALL
      SELECT 'Lotes', COUNT(*) FROM product_batches
      UNION ALL
      SELECT 'Proveedores', COUNT(*) FROM suppliers
      UNION ALL
      SELECT 'Órdenes de Compra', COUNT(*) FROM purchase_orders
      UNION ALL
      SELECT 'Recetas', COUNT(*) FROM prescriptions
      UNION ALL
      SELECT 'Items de Receta', COUNT(*) FROM prescription_items
      UNION ALL
      SELECT 'Permisos', COUNT(*) FROM permissions
      UNION ALL
      SELECT 'Configuraciones', COUNT(*) FROM system_config
      UNION ALL
      SELECT 'Historial de Stock', COUNT(*) FROM stock_history
    `);
    
    stats.forEach(stat => {
      console.log(`  ${stat.tabla}: ${stat.total}`);
    });

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
  populateAllTables()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error al ejecutar el script:', error);
      process.exit(1);
    });
}

module.exports = { populateAllTables };

