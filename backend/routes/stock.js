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

    // Calcular equivalencia en cajas si aplica
    const boxesEquivalent = product.units_per_package > 1 
      ? Math.ceil(quantity / product.units_per_package) 
      : null;
    
    res.json({
      success: true,
      data: {
        batch: updatedBatch,
        product: product,
        quantity_added: quantity,
        message: `Se ingresaron ${quantity} unidades individuales${boxesEquivalent ? ` (equivalente a ${boxesEquivalent} caja${boxesEquivalent > 1 ? 's' : ''} de ${product.units_per_package} unidades cada una)` : ''}`
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

    // Validar cantidad si se proporciona
    if (quantity !== undefined && (quantity <= 0 || !Number.isFinite(quantity))) {
      return res.status(400).json({
        success: false,
        error: 'La cantidad debe ser un número positivo mayor a 0'
      });
    }

    // Buscar lote por RFID
    const batch = await db.getBatchByRfidUid(rfid_uid.toUpperCase().trim());

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Lote no encontrado para el RFID proporcionado. Verifica que el tag RFID esté registrado en el sistema.'
      });
    }

    // Validar stock disponible antes de procesar
    if (batch.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: `Stock insuficiente. Stock disponible: ${batch.quantity} unidades individuales. No se puede retirar stock de un lote sin unidades disponibles.`
      });
    }

    // Obtener producto para verificar units_per_package
    const product = await db.getProductById(batch.product_id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado para este lote'
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
    const quantityToRemove = quantity || 1;

    if (product.units_per_package > 1 && !quantity) {
      return res.status(400).json({
        success: false,
        error: `Este producto es una caja con ${product.units_per_package} unidades individuales por caja. Debe especificar la cantidad de unidades individuales a retirar.`,
        requires_quantity: true,
        units_per_package: product.units_per_package,
        available_stock: batch.quantity
      });
    }

    // Validar que la cantidad no exceda el stock disponible
    if (quantityToRemove > batch.quantity) {
      return res.status(400).json({
        success: false,
        error: `Cantidad excede el stock disponible. Stock disponible: ${batch.quantity} unidades individuales, Intento de retirar: ${quantityToRemove} unidades individuales`
      });
    }

    // Calcular días hasta vencimiento para información adicional
    const expiryDate = batch.expiry_date ? new Date(batch.expiry_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysToExpiry = null;
    let expiryStatus = 'valido';
    
    if (expiryDate) {
      const diffTime = expiryDate - today;
      daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (daysToExpiry < 0) {
        expiryStatus = 'vencido';
      } else if (daysToExpiry <= 30) {
        expiryStatus = 'proximo_vencer';
      }
    }

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

    res.json({
      success: true,
      data: {
        batch: updatedBatch,
        product: product,
        quantity_removed: quantityToRemove,
        remaining_stock: updatedBatch.quantity,
        expiry_status: expiryStatus,
        days_to_expiry: daysToExpiry,
        area: areaInfo ? { id: areaInfo.id, name: areaInfo.name } : null,
        message: `Se retiraron ${quantityToRemove} unidades individuales${product.units_per_package > 1 ? ` (equivalente a ${Math.ceil(quantityToRemove / product.units_per_package)} caja${Math.ceil(quantityToRemove / product.units_per_package) > 1 ? 's' : ''} de ${product.units_per_package} unidades cada una)` : ''}. Stock restante: ${updatedBatch.quantity} unidades individuales.`
      }
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

