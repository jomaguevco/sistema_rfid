/**
 * Script para insertar varios medicamentos de ejemplo en la base de datos
 * Incluye productos médicos con todos sus atributos y lotes iniciales
 */

const mysql = require('mysql2/promise');
const { normalizeRfidCode, formatConcentration } = require('../utils/rfidNormalizer');
require('dotenv').config();

// Función auxiliar para generar fecha futura
function generateFutureDate(minMonths = 6, maxMonths = 36) {
  const now = new Date();
  const months = minMonths + Math.floor(Math.random() * (maxMonths - minMonths));
  const futureDate = new Date(now);
  futureDate.setMonth(futureDate.getMonth() + months);
  return futureDate.toISOString().split('T')[0];
}

// Función para generar número de lote
function generateLotNumber(productId, index = 0) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `LOT-${String(productId).padStart(6, '0')}-${date}-${String(index + 1).padStart(3, '0')}`;
}

async function insertSampleMedications() {
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

    // Obtener categorías existentes o crear una por defecto
    let [categories] = await connection.execute('SELECT id, name FROM product_categories LIMIT 10');
    
    if (categories.length === 0) {
      console.log('⚠️ No hay categorías. Creando categorías básicas...');
      await connection.execute(`
        INSERT INTO product_categories (name, description) VALUES
        ('Antibióticos', 'Medicamentos antibióticos'),
        ('Analgésicos', 'Medicamentos para el dolor'),
        ('Antinflamatorios', 'Medicamentos antinflamatorios'),
        ('Antisépticos', 'Medicamentos antisépticos'),
        ('Insumos Médicos', 'Insumos y materiales médicos')
      `);
      [categories] = await connection.execute('SELECT id, name FROM product_categories');
    }

    const categoryMap = {
      'Antibióticos': categories.find(c => c.name.includes('Antibiótico'))?.id || categories[0]?.id,
      'Analgésicos': categories.find(c => c.name.includes('Analgésico'))?.id || categories[0]?.id,
      'Antinflamatorios': categories.find(c => c.name.includes('Antinflamatorio'))?.id || categories[0]?.id,
      'Antisépticos': categories.find(c => c.name.includes('Antiséptico'))?.id || categories[0]?.id,
      'Insumos Médicos': categories.find(c => c.name.includes('Insumo'))?.id || categories[categories.length - 1]?.id || categories[0]?.id
    };

    // Medicamentos de ejemplo con sus atributos
    const sampleMedications = [
      // Antibióticos
      {
        name: 'Amoxicilina 500mg',
        description: 'Antibiótico de amplio espectro',
        product_type: 'medicamento',
        active_ingredient: 'Amoxicilina',
        concentration: '500mg',
        presentation: 'Cápsulas',
        administration_route: 'Oral',
        category_id: categoryMap['Antibióticos'],
        min_stock: 10,
        requires_refrigeration: false,
        rfid_base: '2090074'
      },
      {
        name: 'Cefalexina 500mg',
        description: 'Antibiótico cefalosporina',
        product_type: 'medicamento',
        active_ingredient: 'Cefalexina',
        concentration: '500mg',
        presentation: 'Cápsulas',
        administration_route: 'Oral',
        category_id: categoryMap['Antibióticos'],
        min_stock: 8,
        requires_refrigeration: false,
        rfid_base: '2090075'
      },
      {
        name: 'Azitromicina 250mg',
        description: 'Antibiótico macrólido',
        product_type: 'medicamento',
        active_ingredient: 'Azitromicina',
        concentration: '250mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antibióticos'],
        min_stock: 12,
        requires_refrigeration: false,
        rfid_base: '2090076'
      },
      // Analgésicos
      {
        name: 'Paracetamol 500mg',
        description: 'Analgésico y antipirético',
        product_type: 'medicamento',
        active_ingredient: 'Paracetamol',
        concentration: '500mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Analgésicos'],
        min_stock: 20,
        requires_refrigeration: false,
        rfid_base: '2090077'
      },
      {
        name: 'Ibuprofeno 400mg',
        description: 'Analgésico y antinflamatorio',
        product_type: 'medicamento',
        active_ingredient: 'Ibuprofeno',
        concentration: '400mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Analgésicos'],
        min_stock: 15,
        requires_refrigeration: false,
        rfid_base: '2090078'
      },
      {
        name: 'Diclofenaco 50mg',
        description: 'Antinflamatorio no esteroideo',
        product_type: 'medicamento',
        active_ingredient: 'Diclofenaco',
        concentration: '50mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antinflamatorios'],
        min_stock: 12,
        requires_refrigeration: false,
        rfid_base: '2090079'
      },
      // Medicamentos con presentación especial
      {
        name: 'Jarabe de Amoxicilina',
        description: 'Suspensión oral de amoxicilina',
        product_type: 'medicamento',
        active_ingredient: 'Amoxicilina',
        concentration: '250mg',
        presentation: 'Jarabe',
        administration_route: 'Oral',
        category_id: categoryMap['Antibióticos'],
        min_stock: 8,
        requires_refrigeration: true,
        rfid_base: '2090080'
      },
      {
        name: 'Gotas Nasales',
        description: 'Descongestionante nasal',
        product_type: 'medicamento',
        active_ingredient: 'Oximetazolina',
        concentration: '0.05%',
        presentation: 'Gotas',
        administration_route: 'Nasal',
        category_id: categoryMap['Antisépticos'],
        min_stock: 10,
        requires_refrigeration: false,
        rfid_base: '2090081'
      },
      // Insumos
      {
        name: 'Gasas Estériles',
        description: 'Gasas esterilizadas para uso médico',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Paquete',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 25,
        requires_refrigeration: false,
        rfid_base: '2090082'
      },
      {
        name: 'Algodón Estéril',
        description: 'Algodón esterilizado',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Paquete',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 30,
        requires_refrigeration: false,
        rfid_base: '2090083'
      },
      {
        name: 'Vendas Elásticas',
        description: 'Vendas elásticas de diferentes tamaños',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Rollo',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 20,
        requires_refrigeration: false,
        rfid_base: '2090084'
      },
      {
        name: 'Jeringas Desechables',
        description: 'Jeringas estériles desechables',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Unidad',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 50,
        requires_refrigeration: false,
        rfid_base: '2090085'
      }
    ];

    console.log(`\n📦 Insertando ${sampleMedications.length} medicamentos de ejemplo...`);
    
    let productsCreated = 0;
    let batchesCreated = 0;

    for (let i = 0; i < sampleMedications.length; i++) {
      const med = sampleMedications[i];
      
      // Verificar si el producto ya existe por nombre
      const [existing] = await connection.execute(
        'SELECT id FROM products WHERE name = ?',
        [med.name]
      );

      if (existing.length > 0) {
        console.log(`  ⏭️  Producto "${med.name}" ya existe, omitiendo...`);
        continue;
      }

      // Formatear concentración si es medicamento
      let concentration = med.concentration;
      if (med.product_type === 'medicamento' && concentration && !concentration.includes('/') && !concentration.includes('%')) {
        concentration = formatConcentration(concentration, med.product_type);
      }

      // Normalizar RFID
      const normalizedRfid = normalizeRfidCode(med.rfid_base) || med.rfid_base;

      // Insertar producto
      const [result] = await connection.execute(
        `INSERT INTO products 
         (name, description, product_type, active_ingredient, concentration, presentation, 
          administration_route, category_id, min_stock, requires_refrigeration, rfid_uid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          med.name,
          med.description,
          med.product_type,
          med.active_ingredient,
          concentration,
          med.presentation,
          med.administration_route,
          med.category_id,
          med.min_stock,
          med.requires_refrigeration ? 1 : 0,
          normalizedRfid
        ]
      );

      const productId = result.insertId;
      productsCreated++;

      // Crear 1-3 lotes para cada producto
      const numBatches = Math.floor(Math.random() * 3) + 1; // 1-3 lotes

      for (let j = 0; j < numBatches; j++) {
        const lotNumber = generateLotNumber(productId, j);
        const expiryDate = generateFutureDate(6, 36);
        const quantity = 20 + Math.floor(Math.random() * 180); // 20-200 unidades
        
        // Usar el mismo RFID base para todos los lotes del mismo producto
        await connection.execute(
          `INSERT INTO product_batches 
           (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
           VALUES (?, ?, ?, ?, ?, CURDATE(), NOW())`,
          [productId, lotNumber, expiryDate, quantity, normalizedRfid]
        );
        batchesCreated++;
      }

      console.log(`  ✓ ${med.name} - ${numBatches} lote(s) creado(s)`);
    }

    console.log(`\n✅ Resumen:`);
    console.log(`   - Productos creados: ${productsCreated}`);
    console.log(`   - Lotes creados: ${batchesCreated}`);
    console.log(`\n✓ Proceso completado exitosamente`);

  } catch (error) {
    console.error('✗ Error al insertar medicamentos:', error);
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
  insertSampleMedications()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { insertSampleMedications };

