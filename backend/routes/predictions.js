const express = require('express');
const router = express.Router();
const predictionEngine = require('../utils/predictionEngine');
const db = require('../database_medical');

async function enhancePredictionRow(row) {
  // Obtener datos históricos reales para ajustes
  const historical = await predictionEngine.getHistoricalConsumption(row.product_id, row.area_id || null, 90);
  const historicalData = historical.values || [];
  
  // Usar datos históricos reales para ajustes (vacío si no hay suficiente historial)
  const adjustment = predictionEngine.applyAdjustments(row.predicted_quantity || 0, row.product_id, row.prediction_period, historicalData);
  const currentStock = row.current_stock !== undefined ? row.current_stock : 0;
  const adjustedPrediction = adjustment.adjusted_prediction;
  const deficit = Math.round(adjustedPrediction - currentStock);

  return {
    ...row,
    adjusted_prediction: adjustedPrediction,
    seasonality_factor: Number(adjustment.seasonality_factor.toFixed(2)),
    external_adjustment: adjustment.external_adjustment,
    safety_stock: Math.round(adjustedPrediction * 0.2),
    deficit,
    recommended_order: deficit > 0 ? deficit + Math.round(adjustedPrediction * 0.2) : 0
  };
}

/**
 * GET /api/predictions/product/:productId
 * Obtener predicciones existentes de un producto
 */
router.get('/product/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const areaId = req.query.area_id ? parseInt(req.query.area_id) : null;
    
    const predictions = await predictionEngine.getPredictions(productId, areaId);
    const [productRows] = await db.pool.execute(
      `SELECT p.id, p.name, COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = p.id), 0) as current_stock
       FROM products p
       WHERE p.id = ?`,
      [productId]
    );
    const currentStock = productRows[0]?.current_stock || 0;
    const enhanced = await Promise.all(predictions.map(prediction =>
      enhancePredictionRow({
        ...prediction,
        product_id: productId,
        current_stock: currentStock
      })
    ));
    
    res.json({
      success: true,
      data: enhanced
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/predictions/product/:productId/generate
 * Generar nuevas predicciones para un producto
 */
router.post('/product/:productId/generate', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const areaId = req.body.area_id ? parseInt(req.body.area_id) : null;
    
    const predictions = await predictionEngine.generateAndSavePredictions(productId, areaId);
    
    res.json({
      success: true,
      data: predictions,
      message: 'Predicciones generadas correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/predictions/product/:productId/calculate
 * Calcular predicción sin guardar (para preview)
 */
router.get('/product/:productId/calculate', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const period = req.query.period || 'month';
    const areaId = req.query.area_id ? parseInt(req.query.area_id) : null;
    
    if (!['month', 'quarter', 'year'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Período inválido. Debe ser: month, quarter o year'
      });
    }
    
    const prediction = await predictionEngine.predictConsumption(productId, period, areaId);
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/predictions/by-area
 * Obtener predicciones agrupadas por área
 */
router.get('/by-area', async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const areaId = req.query.area_id ? parseInt(req.query.area_id) : null;
    
    let query = `
      SELECT cp.*, p.name as product_name, a.name as area_name,
              COALESCE(SUM(pb.quantity), 0) as current_stock
       FROM consumption_predictions cp
       JOIN products p ON cp.product_id = p.id
       LEFT JOIN areas a ON cp.area_id = a.id
       LEFT JOIN product_batches pb ON pb.product_id = p.id
       WHERE cp.prediction_period = ?
       AND cp.calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;
    const params = [period];
    
    if (areaId !== null) {
      query += ' AND cp.area_id = ?';
      params.push(areaId);
    } else {
      query += ' AND cp.area_id IS NULL';
    }
    
    query += ' GROUP BY cp.id, p.name, a.name ORDER BY a.name, cp.predicted_quantity DESC';
    
    const [rows] = await db.pool.execute(query, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/predictions/generate-all
 * Generar predicciones para todos los productos (y por área si se especifica)
 */
router.post('/generate-all', async (req, res) => {
  try {
    const areaId = req.body.area_id ? parseInt(req.body.area_id) : null;
    const [products] = await db.pool.execute('SELECT id FROM products');
    
    const results = [];
    for (const product of products) {
      try {
        const predictions = await predictionEngine.generateAndSavePredictions(product.id, areaId);
        results.push({
          product_id: product.id,
          predictions: predictions.length,
          success: true
        });
      } catch (error) {
        results.push({
          product_id: product.id,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: results,
      message: `Predicciones generadas para ${products.length} productos`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

