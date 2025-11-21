/**
 * Script para insertar MÁS medicamentos de ejemplo con múltiples lotes
 * Este script agrega una variedad adicional de medicamentos e insumos médicos
 */

const mysql = require('mysql2/promise');
const { normalizeRfidCode } = require('../utils/rfidNormalizer');
const { formatConcentration } = require('../utils/rfidNormalizer');
require('dotenv').config();

// Función auxiliar para generar números de lote
function generateLotNumber(productId, batchIndex) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `LOT-${year}-${String(productId).padStart(3, '0')}-${String(batchIndex + 1).padStart(3, '0')}`;
}

// Función auxiliar para generar fechas futuras
function generateFutureDate(minMonths = 6, maxMonths = 36) {
  const now = new Date();
  const monthsToAdd = minMonths + Math.floor(Math.random() * (maxMonths - minMonths + 1));
  const futureDate = new Date(now);
  futureDate.setMonth(now.getMonth() + monthsToAdd);
  return futureDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

async function insertMoreMedications() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || 'josemariano.2003',
      database: process.env.DB_NAME || 'rfid_stock_db',
      multipleStatements: true
    });

    console.log('✓ Conectado a la base de datos\n');

    // Obtener categorías existentes
    let categories = [];
    try {
      [categories] = await connection.execute(
        'SELECT id, name FROM product_categories ORDER BY name'
      );
    } catch (err) {
      console.log('⚠️  Error al obtener categorías:', err.message);
      // Continuar con valores por defecto
    }

    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });

    console.log(`✓ Categorías encontradas: ${categories.length}\n`);

    // Lista ampliada de medicamentos adicionales
    const additionalMedications = [
      // Antibióticos adicionales
      {
        name: 'Eritromicina 500mg',
        description: 'Antibiótico macrólido',
        product_type: 'medicamento',
        active_ingredient: 'Eritromicina',
        concentration: '500mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antibióticos'],
        min_stock: 10,
        requires_refrigeration: false,
        rfid_base: '2090086'
      },
      {
        name: 'Doxiciclina 100mg',
        description: 'Antibiótico tetraciclina',
        product_type: 'medicamento',
        active_ingredient: 'Doxiciclina',
        concentration: '100mg',
        presentation: 'Cápsulas',
        administration_route: 'Oral',
        category_id: categoryMap['Antibióticos'],
        min_stock: 8,
        requires_refrigeration: false,
        rfid_base: '2090087'
      },
      {
        name: 'Ciprofloxacino 500mg',
        description: 'Antibiótico fluoroquinolona',
        product_type: 'medicamento',
        active_ingredient: 'Ciprofloxacino',
        concentration: '500mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antibióticos'],
        min_stock: 12,
        requires_refrigeration: false,
        rfid_base: '2090088'
      },
      
      // Analgésicos adicionales
      {
        name: 'Tramadol 50mg',
        description: 'Analgésico opioide',
        product_type: 'medicamento',
        active_ingredient: 'Tramadol',
        concentration: '50mg',
        presentation: 'Cápsulas',
        administration_route: 'Oral',
        category_id: categoryMap['Analgésicos'],
        min_stock: 15,
        requires_refrigeration: false,
        rfid_base: '2090089'
      },
      {
        name: 'Naproxeno 500mg',
        description: 'Analgésico y antinflamatorio',
        product_type: 'medicamento',
        active_ingredient: 'Naproxeno',
        concentration: '500mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Analgésicos'],
        min_stock: 10,
        requires_refrigeration: false,
        rfid_base: '2090090'
      },
      {
        name: 'Ketorolaco 10mg',
        description: 'Analgésico no esteroideo',
        product_type: 'medicamento',
        active_ingredient: 'Ketorolaco',
        concentration: '10mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Analgésicos'],
        min_stock: 8,
        requires_refrigeration: false,
        rfid_base: '2090091'
      },
      
      // Antinflamatorios adicionales
      {
        name: 'Meloxicam 15mg',
        description: 'Antinflamatorio no esteroideo',
        product_type: 'medicamento',
        active_ingredient: 'Meloxicam',
        concentration: '15mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antinflamatorios'],
        min_stock: 12,
        requires_refrigeration: false,
        rfid_base: '2090092'
      },
      {
        name: 'Celecoxib 200mg',
        description: 'Antinflamatorio selectivo',
        product_type: 'medicamento',
        active_ingredient: 'Celecoxib',
        concentration: '200mg',
        presentation: 'Cápsulas',
        administration_route: 'Oral',
        category_id: categoryMap['Antinflamatorios'],
        min_stock: 10,
        requires_refrigeration: false,
        rfid_base: '2090093'
      },
      
      // Medicamentos para el sistema respiratorio
      {
        name: 'Salbutamol Inhalador',
        description: 'Broncodilatador para asma',
        product_type: 'medicamento',
        active_ingredient: 'Salbutamol',
        concentration: '100mcg',
        presentation: 'Inhalador',
        administration_route: 'Inhalatoria',
        category_id: categoryMap['Antisépticos'] || categoryMap['Antibióticos'],
        min_stock: 15,
        requires_refrigeration: false,
        rfid_base: '2090094'
      },
      {
        name: 'Jarabe para la Tos',
        description: 'Expectorante y mucolítico',
        product_type: 'medicamento',
        active_ingredient: 'Guaifenesina',
        concentration: '100mg',
        presentation: 'Jarabe',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Antibióticos'],
        min_stock: 12,
        requires_refrigeration: false,
        rfid_base: '2090095'
      },
      
      // Medicamentos gastrointestinales
      {
        name: 'Omeprazol 20mg',
        description: 'Inhibidor de la bomba de protones',
        product_type: 'medicamento',
        active_ingredient: 'Omeprazol',
        concentration: '20mg',
        presentation: 'Cápsulas',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Analgésicos'],
        min_stock: 20,
        requires_refrigeration: false,
        rfid_base: '2090096'
      },
      {
        name: 'Lansoprazol 30mg',
        description: 'Protector gástrico',
        product_type: 'medicamento',
        active_ingredient: 'Lansoprazol',
        concentration: '30mg',
        presentation: 'Cápsulas',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Analgésicos'],
        min_stock: 18,
        requires_refrigeration: false,
        rfid_base: '2090097'
      },
      {
        name: 'Dimenhidrinato 50mg',
        description: 'Antiemético y antivertiginoso',
        product_type: 'medicamento',
        active_ingredient: 'Dimenhidrinato',
        concentration: '50mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Analgésicos'],
        min_stock: 10,
        requires_refrigeration: false,
        rfid_base: '2090098'
      },
      
      // Medicamentos tópicos
      {
        name: 'Pomada Antibiótica',
        description: 'Antibiótico tópico',
        product_type: 'medicamento',
        active_ingredient: 'Neomicina',
        concentration: '0.5%',
        presentation: 'Pomada',
        administration_route: 'Tópica',
        category_id: categoryMap['Antibióticos'],
        min_stock: 15,
        requires_refrigeration: false,
        rfid_base: '2090099'
      },
      {
        name: 'Crema Antifúngica',
        description: 'Antifúngico tópico',
        product_type: 'medicamento',
        active_ingredient: 'Clotrimazol',
        concentration: '1%',
        presentation: 'Crema',
        administration_route: 'Tópica',
        category_id: categoryMap['Antisépticos'] || categoryMap['Antibióticos'],
        min_stock: 12,
        requires_refrigeration: false,
        rfid_base: '2090100'
      },
      
      // Más insumos médicos
      {
        name: 'Agujas Estériles',
        description: 'Agujas estériles desechables de diferentes calibres',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Caja',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 30,
        requires_refrigeration: false,
        rfid_base: '2090101'
      },
      {
        name: 'Guantes de Látex',
        description: 'Guantes quirúrgicos estériles',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Caja',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 40,
        requires_refrigeration: false,
        rfid_base: '2090102'
      },
      {
        name: 'Vendas de Yeso',
        description: 'Vendas de yeso para inmovilización',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Rollo',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 20,
        requires_refrigeration: false,
        rfid_base: '2090103'
      },
      {
        name: 'Mascarillas Quirúrgicas',
        description: 'Mascarillas desechables estériles',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Caja',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 50,
        requires_refrigeration: false,
        rfid_base: '2090104'
      },
      {
        name: 'Solución Salina 0.9%',
        description: 'Suero fisiológico estéril',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: '0.9%',
        presentation: 'Bolsa',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 25,
        requires_refrigeration: false,
        rfid_base: '2090105'
      },
      {
        name: 'Alcohol Medicinal 70%',
        description: 'Alcohol antiséptico para desinfección',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: '70%',
        presentation: 'Botella',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 30,
        requires_refrigeration: false,
        rfid_base: '2090106'
      },
      {
        name: 'Algodón Hidrófilo',
        description: 'Algodón absorbente para uso médico',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Paquete',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 35,
        requires_refrigeration: false,
        rfid_base: '2090107'
      },
      {
        name: 'Esparadrapo',
        description: 'Cinta adhesiva médica',
        product_type: 'insumo',
        active_ingredient: null,
        concentration: null,
        presentation: 'Rollo',
        administration_route: null,
        category_id: categoryMap['Insumos Médicos'],
        min_stock: 40,
        requires_refrigeration: false,
        rfid_base: '2090108'
      },
      
      // Medicamentos para diabetes
      {
        name: 'Metformina 500mg',
        description: 'Antidiabético oral',
        product_type: 'medicamento',
        active_ingredient: 'Metformina',
        concentration: '500mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Analgésicos'],
        min_stock: 15,
        requires_refrigeration: false,
        rfid_base: '2090109'
      },
      {
        name: 'Glibenclamida 5mg',
        description: 'Antidiabético oral',
        product_type: 'medicamento',
        active_ingredient: 'Glibenclamida',
        concentration: '5mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Analgésicos'],
        min_stock: 10,
        requires_refrigeration: false,
        rfid_base: '2090110'
      },
      
      // Antihistamínicos
      {
        name: 'Loratadina 10mg',
        description: 'Antihistamínico',
        product_type: 'medicamento',
        active_ingredient: 'Loratadina',
        concentration: '10mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Analgésicos'],
        min_stock: 12,
        requires_refrigeration: false,
        rfid_base: '2090111'
      },
      {
        name: 'Cetirizina 10mg',
        description: 'Antihistamínico',
        product_type: 'medicamento',
        active_ingredient: 'Cetirizina',
        concentration: '10mg',
        presentation: 'Tabletas',
        administration_route: 'Oral',
        category_id: categoryMap['Antisépticos'] || categoryMap['Analgésicos'],
        min_stock: 14,
        requires_refrigeration: false,
        rfid_base: '2090112'
      }
    ];

    console.log(`\n📦 Insertando ${additionalMedications.length} medicamentos adicionales...\n`);
    
    let productsCreated = 0;
    let batchesCreated = 0;
    let productsSkipped = 0;

    for (let i = 0; i < additionalMedications.length; i++) {
      const med = additionalMedications[i];
      
      try {
        // Verificar si el producto ya existe por nombre
        const [existing] = await connection.execute(
          'SELECT id FROM products WHERE name = ?',
          [med.name]
        );

        if (existing.length > 0) {
          console.log(`  ⏭️  Producto "${med.name}" ya existe, omitiendo...`);
          productsSkipped++;
          continue;
        }

        // Verificar que la categoría existe
        if (!med.category_id) {
          console.log(`  ⚠️  Producto "${med.name}" no tiene categoría válida, omitiendo...`);
          productsSkipped++;
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

        // Crear 2-4 lotes para cada producto (más lotes para mejores ejemplos)
        const numBatches = Math.floor(Math.random() * 3) + 2; // 2-4 lotes

        for (let j = 0; j < numBatches; j++) {
          const lotNumber = generateLotNumber(productId, j);
          const expiryDate = generateFutureDate(6, 36);
          const quantity = 25 + Math.floor(Math.random() * 175); // 25-200 unidades
          
          // Usar el mismo RFID base para todos los lotes del mismo producto
          try {
            await connection.execute(
              `INSERT INTO product_batches 
               (product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date, created_at)
               VALUES (?, ?, ?, ?, ?, CURDATE(), NOW())`,
              [productId, lotNumber, expiryDate, quantity, normalizedRfid]
            );
            batchesCreated++;
          } catch (batchError) {
            if (batchError.code === 'ER_DUP_ENTRY') {
              console.log(`    ⚠️  Error: Duplicado en lote ${lotNumber} (RFID: ${normalizedRfid})`);
              console.log(`    💡 Esto puede indicar que la restricción UNIQUE aún existe en rfid_uid`);
            } else {
              throw batchError;
            }
          }
        }

        console.log(`  ✓ ${med.name} - ${numBatches} lote(s) creado(s) | RFID: ${normalizedRfid}`);
      } catch (error) {
        console.error(`  ✗ Error al insertar "${med.name}":`, error.message);
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`    ⚠️  Entrada duplicada detectada`);
        }
        productsSkipped++;
      }
    }

    console.log(`\n✅ Resumen:`);
    console.log(`   - Productos creados: ${productsCreated}`);
    console.log(`   - Productos omitidos: ${productsSkipped}`);
    console.log(`   - Lotes creados: ${batchesCreated}`);
    console.log(`\n✓ Proceso completado exitosamente`);

    if (batchesCreated === 0 && productsCreated > 0) {
      console.log(`\n⚠️  ADVERTENCIA: No se crearon lotes.`);
      console.log(`   Esto puede ser porque la restricción UNIQUE en rfid_uid aún existe.`);
      console.log(`   Ejecuta: database/fix_rfid_constraint.sql para solucionarlo.`);
    }

  } catch (error) {
    console.error('✗ Error al insertar medicamentos:', error);
    console.error('Stack:', error.stack);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  No se puede conectar a la base de datos.');
      console.error('   Asegúrate de que MySQL esté corriendo y las credenciales sean correctas.');
    }
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
  insertMoreMedications()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { insertMoreMedications };

