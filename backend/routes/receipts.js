const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * GET /api/receipts/order/:orderId
 * Obtener todas las recepciones de una orden
 */
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const receipts = await db.getReceiptsByOrder(orderId);
    
    res.json({
      success: true,
      data: receipts
    });
  } catch (error) {
    console.error('Error al obtener recepciones:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener recepciones: ${error.message}`
    });
  }
});

/**
 * GET /api/receipts/:id
 * Obtener recepción por ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    
    // Obtener recepción con información de la orden
    const [receipts] = await db.pool.query(
      `SELECT r.*, po.order_number, po.supplier_id, s.name as supplier_name
       FROM receipts r
       INNER JOIN purchase_orders po ON r.order_id = po.id
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE r.id = ?`,
      [receiptId]
    );
    
    if (receipts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Recepción no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: receipts[0]
    });
  } catch (error) {
    console.error('Error al obtener recepción:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener recepción: ${error.message}`
    });
  }
});

/**
 * POST /api/receipts
 * Crear nueva recepción
 */
router.post('/', authenticateToken, requirePermission('orders.manage'), async (req, res) => {
  try {
    const { order_id, receipt_date, notes } = req.body;
    
    if (!order_id || !receipt_date) {
      return res.status(400).json({
        success: false,
        error: 'order_id y receipt_date son requeridos'
      });
    }
    
    // Verificar que la orden existe y está aprobada
    const order = await db.getPurchaseOrderById(order_id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }
    
    if (order.status !== 'approved' && order.status !== 'ordered') {
      return res.status(400).json({
        success: false,
        error: 'La orden debe estar aprobada o ordenada para recibir'
      });
    }
    
    const userId = req.userId;
    const receipt = await db.createReceipt({
      order_id,
      receipt_date,
      received_by: userId,
      notes
    });
    
    // Actualizar estado de la orden a 'received'
    await db.updatePurchaseOrderStatus(order_id, 'received');
    
    res.status(201).json({
      success: true,
      data: receipt,
      message: 'Recepción creada correctamente'
    });
  } catch (error) {
    console.error('Error al crear recepción:', error);
    res.status(500).json({
      success: false,
      error: `Error al crear recepción: ${error.message}`
    });
  }
});

/**
 * GET /api/receipts
 * Obtener todas las recepciones con filtros
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      order_id,
      start_date,
      end_date,
      received_by,
      limit = 50,
      offset = 0
    } = req.query;
    
    let query = `
      SELECT 
        r.*,
        po.order_number,
        po.supplier_id,
        s.name as supplier_name,
        u.username as received_by_username
      FROM receipts r
      INNER JOIN purchase_orders po ON r.order_id = po.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON r.received_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (order_id) {
      query += ' AND r.order_id = ?';
      params.push(parseInt(order_id));
    }
    
    if (start_date) {
      query += ' AND r.receipt_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND r.receipt_date <= ?';
      params.push(end_date);
    }
    
    if (received_by) {
      query += ' AND r.received_by = ?';
      params.push(parseInt(received_by));
    }
    
    query += ' ORDER BY r.receipt_date DESC, r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [receipts] = await db.pool.query(query, params);
    
    // Obtener total para paginación
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
    const [countResult] = await db.pool.query(countQuery, params.slice(0, -2));
    const total = countResult[0]?.total || 0;
    
    res.json({
      success: true,
      data: receipts,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + receipts.length) < total
      }
    });
  } catch (error) {
    console.error('Error al obtener recepciones:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener recepciones: ${error.message}`
    });
  }
});

module.exports = router;

