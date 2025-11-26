const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/alerts
 * Obtener todas las alertas activas (requiere autenticación)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const alerts = await db.getActiveAlerts();
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/alerts/check
 * Verificar y generar alertas automáticas
 */
router.post('/check', async (req, res) => {
  try {
    const result = await db.checkAndGenerateAlerts();
    res.json({
      success: true,
      message: 'Verificación de alertas completada',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/alerts/:id/resolve
 * Marcar una alerta como resuelta (requiere autenticación)
 */
router.put('/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    await db.pool.execute(
      'UPDATE stock_alerts SET is_resolved = TRUE, resolved_at = NOW() WHERE id = ?',
      [alertId]
    );
    res.json({
      success: true,
      message: 'Alerta marcada como resuelta'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

