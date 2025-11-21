const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../database_medical');
const { parseCSV, validateProductData, normalizeProductData, validateBatchData, normalizeBatchData } = require('../utils/csvParser');
const { parseExcel, getSheetNames } = require('../utils/excelParser');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Configurar multer para subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo CSV y Excel (.xlsx, .xls)'));
    }
  }
});

/**
 * POST /api/import/products
 * Importar productos desde CSV/Excel
 */
router.post('/products', authenticateToken, requirePermission('import.data'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo'
      });
    }

    const fileType = req.file.mimetype;
    let rows = [];

    // Parsear según el tipo de archivo
    if (fileType === 'text/csv') {
      const csvContent = req.file.buffer.toString('utf-8');
      rows = await parseCSV(csvContent);
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      rows = parseExcel(req.file.buffer);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no soportado'
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El archivo está vacío'
      });
    }

    // Validar y procesar datos
    const results = {
      total: rows.length,
      success: 0,
      errors: [],
      warnings: [],
      created: [],
      skipped: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validation = validateProductData(row, i);
      
      if (validation.errors.length > 0) {
        results.errors.push({
          row: i + 1,
          errors: validation.errors
        });
        continue;
      }

      results.warnings.push(...validation.warnings.map(w => ({ row: i + 1, warning: w })));

      const normalizedData = normalizeProductData(row);
      
      try {
        // Verificar si el producto ya existe
        const existingProducts = await db.getAllProducts({ search: normalizedData.name });
        const existing = existingProducts.find(p => p.name.toLowerCase() === normalizedData.name.toLowerCase());
        
        if (existing) {
          results.skipped.push({
            row: i + 1,
            product: normalizedData.name,
            reason: 'Producto ya existe'
          });
          continue;
        }

        // Crear producto
        const newProduct = await db.createProduct(normalizedData);
        results.created.push({
          row: i + 1,
          product: newProduct
        });
        results.success++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          errors: [error.message]
        });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error en importación de productos:', error);
    res.status(500).json({
      success: false,
      error: `Error al importar productos: ${error.message}`
    });
  }
});

/**
 * POST /api/import/batches
 * Importar lotes desde CSV/Excel
 */
router.post('/batches', authenticateToken, requirePermission('import.data'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo'
      });
    }

    const fileType = req.file.mimetype;
    let rows = [];

    // Parsear según el tipo de archivo
    if (fileType === 'text/csv') {
      const csvContent = req.file.buffer.toString('utf-8');
      rows = await parseCSV(csvContent);
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      rows = parseExcel(req.file.buffer);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no soportado'
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El archivo está vacío'
      });
    }

    // Validar y procesar datos
    const results = {
      total: rows.length,
      success: 0,
      errors: [],
      warnings: [],
      created: [],
      skipped: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const validation = validateBatchData(row, i);
      
      if (validation.errors.length > 0) {
        results.errors.push({
          row: i + 1,
          errors: validation.errors
        });
        continue;
      }

      results.warnings.push(...validation.warnings.map(w => ({ row: i + 1, warning: w })));

      const normalizedData = normalizeBatchData(row);
      
      try {
        // Si se proporciona product_name, buscar el ID
        if (normalizedData.product_name && !normalizedData.product_id) {
          const products = await db.getAllProducts({ search: normalizedData.product_name });
          const product = products.find(p => p.name.toLowerCase() === normalizedData.product_name.toLowerCase());
          
          if (!product) {
            results.errors.push({
              row: i + 1,
              errors: [`Producto "${normalizedData.product_name}" no encontrado`]
            });
            continue;
          }
          
          normalizedData.product_id = product.id;
        }

        if (!normalizedData.product_id) {
          results.errors.push({
            row: i + 1,
            errors: ['No se pudo determinar el producto']
          });
          continue;
        }

        // Crear lote
        const newBatch = await db.createBatch(normalizedData);
        results.created.push({
          row: i + 1,
          batch: newBatch
        });
        results.success++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          errors: [error.message]
        });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error en importación de lotes:', error);
    res.status(500).json({
      success: false,
      error: `Error al importar lotes: ${error.message}`
    });
  }
});

/**
 * GET /api/import/template/:type
 * Descargar template CSV para importación
 */
router.get('/template/:type', authenticateToken, requirePermission('import.data'), (req, res) => {
  const type = req.params.type;
  
  let csvContent = '';
  
  if (type === 'products') {
    csvContent = `name,description,product_type,active_ingredient,concentration,presentation,administration_route,category_id,min_stock,requires_refrigeration
Paracetamol 500mg,Analgésico y antipirético,medicamento,Paracetamol,500mg,Tabletas,Oral,2,20,false
Gasas Estériles,Gasas estériles para curaciones,insumo,,,Unidades,Tópico,4,50,false`;
  } else if (type === 'batches') {
    csvContent = `product_id,lot_number,expiry_date,quantity,entry_date,rfid_uid
1,LOT-001,2025-12-31,100,2024-01-15,RFID001
1,LOT-002,2026-06-30,50,2024-02-01,RFID002`;
  } else {
    return res.status(400).json({
      success: false,
      error: 'Tipo de template no válido. Use "products" o "batches"'
    });
  }
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="template_${type}.csv"`);
  res.send(csvContent);
});

module.exports = router;

