const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const businessRules = require('../config/businessRules');

/**
 * GET /api/batches
 * Obtener lotes con filtros (rfid_uid, product_id)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rfid_uid, product_id } = req.query;
    
    if (rfid_uid) {
      // Buscar TODOS los lotes con el mismo RFID
      const batches = await db.getBatchesByRfidUid(rfid_uid.trim());
      return res.json({
        success: true,
        data: batches || []
      });
    }
    
    if (product_id) {
      // Buscar por product_id
      const batches = await db.getProductBatches(parseInt(product_id));
      return res.json({
        success: true,
        data: batches
      });
    }
    
    // Si no hay filtros, retornar error o lista vacía
    return res.status(400).json({
      success: false,
      error: 'Debe proporcionar rfid_uid o product_id como parámetro de consulta'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/batches/rfid/:rfidUid
 * Obtener TODOS los lotes con el mismo código RFID
 * Puede haber múltiples productos con el mismo RFID
 */
router.get('/rfid/:rfidUid', authenticateToken, async (req, res) => {
  try {
    const { rfidUid } = req.params;
    
    if (!rfidUid) {
      return res.status(400).json({
        success: false,
        error: 'El código RFID es requerido'
      });
    }
    
    const batches = await db.getBatchesByRfidUid(rfidUid.trim());
    
    return res.json({
      success: true,
      data: batches || []
    });
  } catch (error) {
    console.error('✗ Error en GET /api/batches/rfid/:rfidUid:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/batches/product/:productId
 * Obtener todos los lotes de un producto
 */
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const batches = await db.getProductBatches(parseInt(req.params.productId));
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/batches/:id
 * Obtener un lote por ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const batch = await db.getBatchById(parseInt(req.params.id));
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado'
      });
    }
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/batches
 * Crear un nuevo lote
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, lot_number, expiry_date, quantity, rfid_uid, entry_date } = req.body;
    
    if (!product_id || !lot_number || !expiry_date) {
      return res.status(400).json({
        success: false,
        error: 'product_id, lot_number y expiry_date son requeridos'
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIONES DE NEGOCIO - CREAR LOTE
    // ═══════════════════════════════════════════════════════════════════════════

    // VALIDACIÓN CRÍTICA: No permitir crear lotes con fecha de vencimiento pasada
    if (!businessRules.ALLOW_PAST_EXPIRY_DATE && businessRules.isBatchExpired(expiry_date)) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.BATCH_EXPIRY_PAST,
        expiry_date: expiry_date,
        days_expired: Math.abs(businessRules.getDaysUntilExpiry(expiry_date))
      });
    }

    // Validar que el producto exista
    const product = await db.getProductById(parseInt(product_id));
    if (!product) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.PRODUCT_NOT_FOUND
      });
    }

    // Validar formato de RFID si se proporciona
    if (rfid_uid) {
      if (!businessRules.isValidRfidFormat(rfid_uid)) {
        return res.status(400).json({
          success: false,
          error: businessRules.ERROR_MESSAGES.RFID_INVALID_FORMAT
        });
      }

      const normalizedRfid = rfid_uid.toUpperCase().trim();
      const hasActiveStock = await db.checkRfidHasActiveStock(normalizedRfid);
      
      if (hasActiveStock) {
        // Obtener información del lote con stock activo para el mensaje de error
        const batchesWithStock = await db.getBatchesByRfidUid(normalizedRfid);
        const activeBatch = batchesWithStock.find(b => b.quantity > 0);
        
        if (activeBatch) {
          return res.status(400).json({
            success: false,
            error: `Este código RFID ya tiene stock activo en el sistema (${activeBatch.quantity} unidades del producto "${activeBatch.product_name || 'N/A'}"). Solo se puede ingresar nuevamente cuando el stock llegue a 0.`,
            batch_info: {
              product_name: activeBatch.product_name,
              quantity: activeBatch.quantity,
              lot_number: activeBatch.lot_number,
              expiry_date: activeBatch.expiry_date
            }
          });
        }
      }
    }

    // Validar quantity antes de crear batch
    const quantityValue = parseInt(quantity, 10);
    if (!quantity || isNaN(quantityValue) || quantityValue < businessRules.MIN_QUANTITY) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.QUANTITY_INVALID
      });
    }

    if (quantityValue > businessRules.MAX_QUANTITY_PER_OPERATION) {
      return res.status(400).json({
        success: false,
        error: businessRules.formatErrorMessage(
          businessRules.ERROR_MESSAGES.QUANTITY_EXCEEDS_MAX,
          { max: businessRules.MAX_QUANTITY_PER_OPERATION }
        )
      });
    }

    const batch = await db.createBatch({
      product_id: parseInt(product_id),
      lot_number: lot_number.trim(),
      expiry_date,
      quantity: quantityValue,
      rfid_uid: rfid_uid || null,
      entry_date: entry_date || new Date()
    });

    res.status(201).json({
      success: true,
      data: batch,
      message: 'Lote creado correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un lote con ese número para este producto'
      });
    }
    if (error.code === 'RFID_DUPLICATE') {
      return res.status(400).json({
        success: false,
        error: error.message || 'Este código RFID ya está registrado en otro lote',
        batch_info: error.batch_info || null
      });
    }
    if (error.code === 'RFID_HAS_ACTIVE_STOCK') {
      return res.status(400).json({
        success: false,
        error: error.message,
        batch_info: error.batch_info || null
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/batches/:id/quantity
 * Actualizar cantidad de un lote (solo admin y farmaceutico)
 */
router.put('/:id/quantity', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        error: 'La cantidad debe ser un número positivo'
      });
    }

    const batch = await db.updateBatchQuantity(batchId, parseInt(quantity));
    res.json({
      success: true,
      data: batch,
      message: 'Cantidad actualizada correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/batches/:id/rfid
 * Asignar RFID a un lote (solo admin y farmaceutico)
 */
router.put('/:id/rfid', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const { rfid_uid } = req.body;

    if (!rfid_uid || rfid_uid.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'rfid_uid es requerido'
      });
    }

    // Verificar que el RFID no esté asignado a otro lote
    const existingBatch = await db.getBatchByRfidUid(rfid_uid.trim().toUpperCase());
    if (existingBatch && existingBatch.id !== batchId) {
      return res.status(400).json({
        success: false,
        error: 'Este tag RFID ya está asignado a otro lote'
      });
    }

    await db.pool.execute(
      'UPDATE product_batches SET rfid_uid = ? WHERE id = ?',
      [rfid_uid.trim().toUpperCase(), batchId]
    );

    const batch = await db.getBatchById(batchId);
    res.json({
      success: true,
      data: batch,
      message: 'RFID asignado correctamente al lote'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/batches/:id
 * Eliminar un lote (solo para administradores)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario sea administrador
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo los administradores pueden eliminar lotes'
      });
    }

    const batchId = parseInt(req.params.id);
    const result = await db.deleteBatch(batchId);

    res.json({
      success: true,
      data: result,
      message: 'Lote eliminado correctamente'
    });
  } catch (error) {
    if (error.code === 'BATCH_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

