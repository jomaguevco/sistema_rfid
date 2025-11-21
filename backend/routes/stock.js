const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/stock/entry
 * Entrada de producto con RFID
 */
router.post('/entry', authenticateToken, async (req, res) => {
  try {
    const { rfid_uid, quantity, area_id } = req.body;

    if (!rfid_uid || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: rfid_uid, quantity (debe ser mayor a 0)'
      });
    }

    // Buscar lote por RFID
    const batch = await db.getBatchByRfidUid(rfid_uid.toUpperCase().trim());

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado para el RFID proporcionado'
      });
    }

    // Obtener producto para verificar units_per_package
    const product = await db.getProductById(batch.product_id);

    // Incrementar stock
    const updatedBatch = await db.incrementBatchStock(rfid_uid.toUpperCase().trim(), quantity, area_id || null);

    res.json({
      success: true,
      data: {
        batch: updatedBatch,
        product: product,
        quantity_added: quantity,
        message: `Se ingresaron ${quantity} unidades${product.units_per_package > 1 ? ` (${quantity} unidades de ${product.units_per_package} por caja)` : ''}`
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

    if (!rfid_uid) {
      return res.status(400).json({
        success: false,
        error: 'Falta campo requerido: rfid_uid'
      });
    }

    // Buscar lote por RFID
    const batch = await db.getBatchByRfidUid(rfid_uid.toUpperCase().trim());

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado para el RFID proporcionado'
      });
    }

    // Obtener producto para verificar units_per_package
    const product = await db.getProductById(batch.product_id);

    // Si es una caja (units_per_package > 1), quantity es requerido
    const quantityToRemove = quantity || 1;

    if (product.units_per_package > 1 && !quantity) {
      return res.status(400).json({
        success: false,
        error: `Este producto es una caja con ${product.units_per_package} unidades. Debe especificar la cantidad a retirar.`,
        requires_quantity: true,
        units_per_package: product.units_per_package
      });
    }

    // Decrementar stock
    const updatedBatch = await db.decrementBatchStock(rfid_uid.toUpperCase().trim(), quantityToRemove, area_id || null);

    res.json({
      success: true,
      data: {
        batch: updatedBatch,
        product: product,
        quantity_removed: quantityToRemove,
        message: `Se retiraron ${quantityToRemove} unidades${product.units_per_package > 1 ? ` (de caja con ${product.units_per_package} unidades)` : ''}`
      }
    });
  } catch (error) {
    console.error('Error al retirar stock:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

