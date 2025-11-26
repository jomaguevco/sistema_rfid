const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const businessRules = require('../config/businessRules');

/**
 * POST /api/stock/entry
 * Entrada de producto con RFID
 */
router.post('/entry', authenticateToken, async (req, res) => {
  try {
    const { rfid_uid, quantity, area_id } = req.body;

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIONES DE NEGOCIO - ENTRADA DE STOCK
    // ═══════════════════════════════════════════════════════════════════════════

    if (!rfid_uid) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.RFID_REQUIRED
      });
    }

    // Validar formato de RFID
    if (!businessRules.isValidRfidFormat(rfid_uid)) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.RFID_INVALID_FORMAT
      });
    }

    // Validar cantidad
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < businessRules.MIN_QUANTITY) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.QUANTITY_INVALID
      });
    }

    if (qty > businessRules.MAX_QUANTITY_PER_OPERATION) {
      return res.status(400).json({
        success: false,
        error: businessRules.formatErrorMessage(
          businessRules.ERROR_MESSAGES.QUANTITY_EXCEEDS_MAX,
          { max: businessRules.MAX_QUANTITY_PER_OPERATION }
        )
      });
    }

    // Buscar lote por RFID
    const batch = await db.getBatchByRfidUid(rfid_uid.toUpperCase().trim());

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.BATCH_NOT_FOUND
      });
    }

    // Obtener producto para verificar units_per_package
    const product = await db.getProductById(batch.product_id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.PRODUCT_NOT_FOUND
      });
    }

    // Incrementar stock
    const updatedBatch = await db.incrementBatchStock(rfid_uid.toUpperCase().trim(), qty, area_id || null);

    // Calcular equivalencia en cajas si aplica
    const boxesEquivalent = product.units_per_package > 1 
      ? Math.ceil(qty / product.units_per_package) 
      : null;
    
    res.json({
      success: true,
      data: {
        batch: updatedBatch,
        product: product,
        quantity_added: qty,
        message: `Se ingresaron ${qty} unidades individuales${boxesEquivalent ? ` (equivalente a ${boxesEquivalent} caja${boxesEquivalent > 1 ? 's' : ''} de ${product.units_per_package} unidades cada una)` : ''}`
      }
    });
  } catch (error) {
    console.error('Error al ingresar stock:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/stock/exit
 * Salida de producto con RFID
 */
router.post('/exit', authenticateToken, async (req, res) => {
  try {
    const { rfid_uid, quantity, area_id } = req.body;

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIONES DE NEGOCIO - SALIDA DE STOCK
    // ═══════════════════════════════════════════════════════════════════════════

    if (!rfid_uid) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.RFID_REQUIRED
      });
    }

    // Validar formato de RFID
    if (!businessRules.isValidRfidFormat(rfid_uid)) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.RFID_INVALID_FORMAT
      });
    }

    // Validar cantidad si se proporciona
    if (quantity !== undefined) {
      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty < businessRules.MIN_QUANTITY) {
        return res.status(400).json({
          success: false,
          error: businessRules.ERROR_MESSAGES.QUANTITY_INVALID
        });
      }
      if (qty > businessRules.MAX_QUANTITY_PER_OPERATION) {
        return res.status(400).json({
          success: false,
          error: businessRules.formatErrorMessage(
            businessRules.ERROR_MESSAGES.QUANTITY_EXCEEDS_MAX,
            { max: businessRules.MAX_QUANTITY_PER_OPERATION }
          )
        });
      }
    }

    // Buscar lote por RFID
    const batch = await db.getBatchByRfidUid(rfid_uid.toUpperCase().trim());

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.BATCH_NOT_FOUND
      });
    }

    // VALIDACIÓN CRÍTICA: No permitir salidas de lotes vencidos
    if (!businessRules.ALLOW_EXPIRED_BATCH_DISPATCH && businessRules.isBatchExpired(batch.expiry_date)) {
      return res.status(400).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.BATCH_EXPIRED,
        batch_expiry_date: batch.expiry_date,
        days_expired: Math.abs(businessRules.getDaysUntilExpiry(batch.expiry_date))
      });
    }

    // Validar stock disponible antes de procesar
    if (batch.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: businessRules.formatErrorMessage(
          businessRules.ERROR_MESSAGES.STOCK_INSUFFICIENT,
          { available: batch.quantity }
        )
      });
    }

    // Obtener producto para verificar units_per_package y stock mínimo
    const product = await db.getProductById(batch.product_id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: businessRules.ERROR_MESSAGES.PRODUCT_NOT_FOUND
      });
    }

    // Validar área si se proporciona
    if (area_id) {
      const area = await db.getAreaById(parseInt(area_id));
      if (!area) {
        return res.status(400).json({
          success: false,
          error: 'El área especificada no existe'
        });
      }
    }

    // Si es una caja (units_per_package > 1), quantity es requerido
    const quantityToRemove = quantity ? parseInt(quantity, 10) : 1;

    if (product.units_per_package > 1 && !quantity) {
      return res.status(400).json({
        success: false,
        error: `Este producto es una caja con ${product.units_per_package} unidades individuales por caja. Debe especificar la cantidad de unidades individuales a retirar.`,
        requires_quantity: true,
        units_per_package: product.units_per_package,
        available_stock: batch.quantity
      });
    }

    // VALIDACIÓN CRÍTICA: No permitir stock negativo
    if (quantityToRemove > batch.quantity) {
      return res.status(400).json({
        success: false,
        error: businessRules.formatErrorMessage(
          businessRules.ERROR_MESSAGES.STOCK_INSUFFICIENT,
          { available: batch.quantity }
        ),
        available_stock: batch.quantity,
        requested: quantityToRemove
      });
    }

    // Calcular stock restante para advertencia de stock mínimo
    const remainingStock = batch.quantity - quantityToRemove;
    const minStock = product.min_stock || businessRules.DEFAULT_MIN_STOCK;
    let stockWarning = null;
    
    if (remainingStock < minStock) {
      stockWarning = businessRules.formatErrorMessage(
        businessRules.ERROR_MESSAGES.STOCK_BELOW_MINIMUM,
        { min: minStock }
      );
    }

    // Calcular días hasta vencimiento para información adicional
    const daysToExpiry = businessRules.getDaysUntilExpiry(batch.expiry_date);
    const expiryStatus = businessRules.getExpiryStatus(batch.expiry_date);

    // Decrementar stock
    const updatedBatch = await db.decrementBatchStock(rfid_uid.toUpperCase().trim(), quantityToRemove, area_id || null);

    // Obtener información del área si se proporcionó
    let areaInfo = null;
    if (area_id) {
      try {
        areaInfo = await db.getAreaById(parseInt(area_id));
      } catch (err) {
        // Ignorar error al obtener área
      }
    }

    // Construir mensaje de respuesta
    let message = `Se retiraron ${quantityToRemove} unidades individuales`;
    if (product.units_per_package > 1) {
      const boxes = Math.ceil(quantityToRemove / product.units_per_package);
      message += ` (equivalente a ${boxes} caja${boxes > 1 ? 's' : ''} de ${product.units_per_package} unidades cada una)`;
    }
    message += `. Stock restante: ${updatedBatch.quantity} unidades individuales.`;
    
    // Agregar advertencia de stock bajo si aplica
    if (stockWarning) {
      message += ` ⚠️ ${stockWarning}`;
    }

    res.json({
      success: true,
      data: {
        batch: updatedBatch,
        product: product,
        quantity_removed: quantityToRemove,
        remaining_stock: updatedBatch.quantity,
        min_stock: minStock,
        is_below_min_stock: remainingStock < minStock,
        expiry_status: expiryStatus,
        days_to_expiry: daysToExpiry,
        area: areaInfo ? { id: areaInfo.id, name: areaInfo.name } : null,
        message: message
      },
      warning: stockWarning
    });
  } catch (error) {
    console.error('Error al retirar stock:', error);
    
    // Manejar errores específicos
    if (error.message.includes('Stock insuficiente') || error.message.includes('insuficiente')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('vencido')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar el retiro de stock'
    });
  }
});

module.exports = router;

