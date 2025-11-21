const express = require('express');
const router = express.Router();
const db = require('../database_medical');

/**
 * GET /api/traceability
 * Obtener historial completo con filtros avanzados
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      product_id: req.query.product_id ? parseInt(req.query.product_id) : null,
      batch_id: req.query.batch_id ? parseInt(req.query.batch_id) : null,
      area_id: req.query.area_id ? parseInt(req.query.area_id) : null,
      action: req.query.action || null,
      start_date: req.query.start_date || null,
      end_date: req.query.end_date || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 500
    };
    
    const history = await db.getAllStockHistory(filters);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/traceability/product/:id
 * Obtener historial de un producto específico
 */
router.get('/product/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const filters = {
      area_id: req.query.area_id ? parseInt(req.query.area_id) : null,
      start_date: req.query.start_date || null,
      end_date: req.query.end_date || null
    };
    
    const history = await db.getStockHistory(productId, filters);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/traceability/batch/:id
 * Obtener historial de un lote específico
 */
router.get('/batch/:id', async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const filters = {
      start_date: req.query.start_date || null,
      end_date: req.query.end_date || null
    };
    
    const history = await db.getBatchHistory(batchId, filters);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/traceability/area/:id
 * Obtener historial de un área específica
 */
router.get('/area/:id', async (req, res) => {
  try {
    const areaId = parseInt(req.params.id);
    const filters = {
      product_id: req.query.product_id ? parseInt(req.query.product_id) : null,
      start_date: req.query.start_date || null,
      end_date: req.query.end_date || null
    };
    
    const history = await db.getAreaHistory(areaId, filters);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

