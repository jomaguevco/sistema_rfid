const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/orders
 * Obtener todas las órdenes de compra
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      supplier_id: req.query.supplier_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    const orders = await db.getAllPurchaseOrders(filters);
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener órdenes: ${error.message}`
    });
  }
});

/**
 * GET /api/orders/:id
 * Obtener orden por ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await db.getPurchaseOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }
    
    // Obtener items de la orden
    const items = await db.getPurchaseOrderItems(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...order,
        items
      }
    });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener orden: ${error.message}`
    });
  }
});

/**
 * POST /api/orders
 * Crear nueva orden de compra
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { supplier_id, order_number, order_date, notes, items } = req.body;
    
    if (!supplier_id || !order_number || !order_date) {
      return res.status(400).json({
        success: false,
        error: 'Proveedor, número de orden y fecha son requeridos'
      });
    }
    
    const userId = req.userId;
    const order = await db.createPurchaseOrder({
      supplier_id,
      order_number,
      order_date,
      notes,
      created_by: userId
    });
    
    // Crear items si se proporcionaron
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await db.createPurchaseOrderItem({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes
        });
      }
    }
    
    // Obtener orden completa con items
    const fullOrder = await db.getPurchaseOrderById(order.id);
    const orderItems = await db.getPurchaseOrderItems(order.id);
    
    res.status(201).json({
      success: true,
      data: {
        ...fullOrder,
        items: orderItems
      }
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    res.status(500).json({
      success: false,
      error: `Error al crear orden: ${error.message}`
    });
  }
});

/**
 * PUT /api/orders/:id/status
 * Actualizar estado de orden
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.userId;
    
    if (!['pending', 'approved', 'received', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Estado inválido'
      });
    }
    
    const order = await db.updatePurchaseOrderStatus(req.params.id, status, userId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }
    
    const items = await db.getPurchaseOrderItems(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...order,
        items
      }
    });
  } catch (error) {
    console.error('Error al actualizar estado de orden:', error);
    res.status(500).json({
      success: false,
      error: `Error al actualizar estado: ${error.message}`
    });
  }
});

/**
 * POST /api/orders/:id/items
 * Agregar item a orden
 */
router.post('/:id/items', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity, unit_price, notes } = req.body;
    
    if (!product_id || !quantity || !unit_price) {
      return res.status(400).json({
        success: false,
        error: 'Producto, cantidad y precio unitario son requeridos'
      });
    }
    
    const item = await db.createPurchaseOrderItem({
      order_id: req.params.id,
      product_id,
      quantity,
      unit_price,
      notes
    });
    
    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error al agregar item:', error);
    res.status(500).json({
      success: false,
      error: `Error al agregar item: ${error.message}`
    });
  }
});

/**
 * PUT /api/orders/:id/items/:itemId
 * Actualizar item de orden
 */
router.put('/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const item = await db.updatePurchaseOrderItem(req.params.itemId, req.body);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item no encontrado'
      });
    }
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error al actualizar item:', error);
    res.status(500).json({
      success: false,
      error: `Error al actualizar item: ${error.message}`
    });
  }
});

/**
 * DELETE /api/orders/:id/items/:itemId
 * Eliminar item de orden
 */
router.delete('/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    await db.deletePurchaseOrderItem(req.params.itemId);
    res.json({
      success: true,
      message: 'Item eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar item:', error);
    res.status(500).json({
      success: false,
      error: `Error al eliminar item: ${error.message}`
    });
  }
});

/**
 * POST /api/orders/:id/receive
 * Registrar recepción de orden
 */
router.post('/:id/receive', authenticateToken, async (req, res) => {
  try {
    const { receipt_date, notes, items } = req.body;
    const userId = req.userId;
    
    if (!receipt_date) {
      return res.status(400).json({
        success: false,
        error: 'Fecha de recepción es requerida'
      });
    }
    
    // Crear recepción
    const receipt = await db.createReceipt({
      order_id: req.params.id,
      receipt_date,
      received_by: userId,
      notes
    });
    
    // Actualizar cantidades recibidas de items si se proporcionaron
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.item_id && item.received_quantity !== undefined) {
          await db.updatePurchaseOrderItem(item.item_id, {
            received_quantity: item.received_quantity
          });
        }
      }
    }
    
    res.status(201).json({
      success: true,
      data: receipt
    });
  } catch (error) {
    console.error('Error al registrar recepción:', error);
    res.status(500).json({
      success: false,
      error: `Error al registrar recepción: ${error.message}`
    });
  }
});

module.exports = router;

