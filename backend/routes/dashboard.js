const express = require('express');
const router = express.Router();
const db = require('../database_medical');

/**
 * GET /api/dashboard/stats
 * Obtener estadísticas generales del dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const [products] = await db.pool.execute(
      `SELECT COUNT(*) as total FROM products`
    );
    
    const [expiredBatches] = await db.pool.execute(
      `SELECT COUNT(*) as total FROM product_batches WHERE expiry_date < CURDATE() AND quantity > 0`
    );
    
    const [expiringBatches] = await db.pool.execute(
      `SELECT COUNT(*) as total FROM product_batches 
       WHERE DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 30 AND expiry_date >= CURDATE() AND quantity > 0`
    );
    
    const [lowStockProducts] = await db.pool.execute(
      `SELECT COUNT(*) as total
       FROM (
         SELECT p.id, p.min_stock, COALESCE(SUM(pb.quantity), 0) as total_stock
         FROM products p
         LEFT JOIN product_batches pb ON pb.product_id = p.id
         GROUP BY p.id, p.min_stock
         HAVING total_stock <= p.min_stock
       ) as low_stock`
    );
    
    const [alerts] = await db.pool.execute(
      `SELECT COUNT(*) as total FROM stock_alerts WHERE is_resolved = FALSE`
    );
    
    const [criticalAlerts] = await db.pool.execute(
      `SELECT COUNT(*) as total FROM stock_alerts 
       WHERE is_resolved = FALSE AND severity = 'critical'`
    );
    
    const [totalStock] = await db.pool.execute(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM product_batches WHERE quantity > 0`
    );

    res.json({
      success: true,
      data: {
        total_products: products[0].total,
        expired_products: expiredBatches[0].total,
        expiring_soon: expiringBatches[0].total,
        low_stock_products: lowStockProducts.length,
        total_alerts: alerts[0].total,
        critical_alerts: criticalAlerts[0].total,
        total_stock: totalStock[0].total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/dashboard/expiring
 * Obtener productos por vencer (próximos 30 días)
 */
router.get('/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const [rows] = await db.pool.execute(
      `SELECT pb.*, p.name as product_name, p.min_stock, pc.name as category_name,
              DATEDIFF(pb.expiry_date, CURDATE()) as days_to_expiry
       FROM product_batches pb
       JOIN products p ON pb.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE DATEDIFF(pb.expiry_date, CURDATE()) BETWEEN 0 AND ? 
       AND pb.expiry_date >= CURDATE() 
       AND pb.quantity > 0
       ORDER BY pb.expiry_date ASC
       LIMIT 50`,
      [days]
    );
    
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
 * GET /api/dashboard/low-stock
 * Obtener productos con stock bajo
 */
router.get('/low-stock', async (req, res) => {
  try {
    const [rows] = await db.pool.execute(
      `SELECT p.*, pc.name as category_name,
              COALESCE(SUM(pb.quantity), 0) as current_stock
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN product_batches pb ON pb.product_id = p.id
       GROUP BY p.id
       HAVING current_stock <= p.min_stock
       ORDER BY current_stock ASC
       LIMIT 50`
    );
    
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
 * GET /api/dashboard/consumption-by-area
 * Obtener consumo por área (últimos 30 días)
 */
router.get('/consumption-by-area', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [rows] = await db.pool.execute(
      `SELECT a.id, a.name as area_name,
              COUNT(*) as total_removals,
              SUM(sh.previous_stock - sh.new_stock) as total_consumed
       FROM stock_history sh
       JOIN areas a ON sh.area_id = a.id
       WHERE sh.action = 'remove' 
       AND sh.consumption_date >= ?
       GROUP BY a.id, a.name
       ORDER BY total_consumed DESC`,
      [startDate.toISOString().split('T')[0]]
    );
    
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
 * GET /api/dashboard/products-by-category
 * Obtener distribución de productos por categoría
 */
router.get('/products-by-category', async (req, res) => {
  try {
    const [rows] = await db.pool.execute(
      `SELECT pc.id, pc.name as category_name,
              COUNT(DISTINCT p.id) as product_count,
              COALESCE(SUM(pb.quantity), 0) as total_stock
       FROM product_categories pc
       LEFT JOIN products p ON p.category_id = pc.id
       LEFT JOIN product_batches pb ON pb.product_id = p.id
       GROUP BY pc.id, pc.name
       ORDER BY product_count DESC`
    );
    
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
 * GET /api/dashboard/expiry-distribution
 * Obtener distribución de vencimientos por rangos de días (para gráfico)
 */
router.get('/expiry-distribution', async (req, res) => {
  try {
    const [rows] = await db.pool.execute(
      `SELECT 
        CASE 
          WHEN DATEDIFF(expiry_date, CURDATE()) < 0 THEN 'Vencidos'
          WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 7 THEN '0-7 días'
          WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 8 AND 15 THEN '8-15 días'
          WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 16 AND 30 THEN '16-30 días'
          WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 31 AND 60 THEN '31-60 días'
          WHEN DATEDIFF(expiry_date, CURDATE()) BETWEEN 61 AND 90 THEN '61-90 días'
          ELSE 'Más de 90 días'
        END as range_label,
        COUNT(*) as batch_count,
        SUM(quantity) as total_quantity
       FROM product_batches
       WHERE quantity > 0
       GROUP BY range_label
       ORDER BY 
         CASE range_label
           WHEN 'Vencidos' THEN 1
           WHEN '0-7 días' THEN 2
           WHEN '8-15 días' THEN 3
           WHEN '16-30 días' THEN 4
           WHEN '31-60 días' THEN 5
           WHEN '61-90 días' THEN 6
           ELSE 7
         END`
    );
    
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
 * GET /api/dashboard/consumption-trend
 * Obtener tendencia de consumo (últimos 30 días por día)
 */
router.get('/consumption-trend', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [rows] = await db.pool.execute(
      `SELECT 
        DATE(sh.consumption_date) as date,
        COALESCE(SUM(sh.previous_stock - sh.new_stock), 0) as total_consumed,
        COUNT(*) as total_removals
       FROM stock_history sh
       WHERE sh.action = 'remove' 
       AND sh.consumption_date >= ?
       GROUP BY DATE(sh.consumption_date)
       ORDER BY date ASC`,
      [startDate.toISOString().split('T')[0]]
    );
    
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
 * GET /api/dashboard/predictions-summary
 * Obtener resumen de predicciones para dashboard
 */
router.get('/predictions-summary', async (req, res) => {
  try {
    const [monthPredictions] = await db.pool.execute(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN cp.predicted_quantity > COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = cp.product_id), 0) THEN 1 ELSE 0 END) as insufficient
       FROM consumption_predictions cp
       WHERE cp.prediction_period = 'month' 
       AND cp.calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND cp.area_id IS NULL`
    );
    
    const [quarterPredictions] = await db.pool.execute(
      `SELECT COUNT(*) as total
       FROM consumption_predictions cp
       WHERE cp.prediction_period = 'quarter' 
       AND cp.calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND cp.area_id IS NULL`
    );
    
    const [yearPredictions] = await db.pool.execute(
      `SELECT COUNT(*) as total
       FROM consumption_predictions cp
       WHERE cp.prediction_period = 'year' 
       AND cp.calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND cp.area_id IS NULL`
    );
    
    const [topDeficit] = await db.pool.execute(
      `SELECT cp.*, p.name as product_name,
              COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = cp.product_id), 0) as current_stock,
              (cp.predicted_quantity - COALESCE((SELECT SUM(pb.quantity) FROM product_batches pb WHERE pb.product_id = cp.product_id), 0)) as deficit
       FROM consumption_predictions cp
       JOIN products p ON cp.product_id = p.id
       WHERE cp.prediction_period = 'month'
       AND cp.calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND cp.area_id IS NULL
       HAVING deficit > 0
       ORDER BY deficit DESC
       LIMIT 10`
    );
    
    res.json({
      success: true,
      data: {
        month: {
          total: monthPredictions[0].total,
          insufficient: monthPredictions[0].insufficient || 0
        },
        quarter: {
          total: quarterPredictions[0].total
        },
        year: {
          total: yearPredictions[0].total
        },
        top_deficit: topDeficit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/dashboard/top-products
 * Obtener top productos más consumidos (últimos 30 días)
 */
router.get('/top-products', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 10;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const [rows] = await db.pool.execute(
      `SELECT p.id, p.name as product_name, pc.name as category_name,
              SUM(sh.previous_stock - sh.new_stock) as total_consumed,
              COUNT(*) as removal_count
       FROM stock_history sh
       JOIN products p ON sh.product_id = p.id
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE sh.action = 'remove' 
       AND sh.consumption_date >= ?
       GROUP BY p.id, p.name, pc.name
       ORDER BY total_consumed DESC
       LIMIT ?`,
      [startDate.toISOString().split('T')[0], limit]
    );
    
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

module.exports = router;

