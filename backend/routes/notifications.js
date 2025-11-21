const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { sendEmail, getExpiredProductTemplate, getExpiringProductTemplate, getLowStockTemplate, getDailyAlertsSummaryTemplate } = require('../utils/email');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * POST /api/notifications/send-test
 * Enviar email de prueba
 */
router.post('/send-test', authenticateToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email requerido'
      });
    }
    
    const result = await sendEmail(
      email,
      'Prueba de Notificaciones - Sistema Stock Médico',
      '<h1>Prueba de Email</h1><p>Este es un email de prueba del sistema de notificaciones.</p>'
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Email de prueba enviado correctamente'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Error al enviar email'
      });
    }
  } catch (error) {
    console.error('Error al enviar email de prueba:', error);
    res.status(500).json({
      success: false,
      error: `Error al enviar email: ${error.message}`
    });
  }
});

/**
 * POST /api/notifications/send-alert
 * Enviar notificación de alerta específica
 */
router.post('/send-alert', authenticateToken, async (req, res) => {
  try {
    const { alertId, email } = req.body;
    
    if (!alertId || !email) {
      return res.status(400).json({
        success: false,
        error: 'alertId y email son requeridos'
      });
    }
    
    // Obtener alerta
    const alerts = await db.getActiveAlerts();
    const alert = alerts.find(a => a.id === parseInt(alertId));
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alerta no encontrada'
      });
    }
    
    // Obtener producto
    const product = await db.getProductById(alert.product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }
    
    let html = '';
    let subject = '';
    
    if (alert.alert_type === 'expired' && alert.batch_id) {
      const batch = await db.getBatchById(alert.batch_id);
      html = getExpiredProductTemplate(product, batch);
      subject = `⚠️ Alerta: ${product.name} - Producto Vencido`;
    } else if (alert.alert_type === 'expiring_soon' && alert.batch_id) {
      const batch = await db.getBatchById(alert.batch_id);
      const daysLeft = Math.ceil((new Date(batch.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
      html = getExpiringProductTemplate(product, batch, daysLeft);
      subject = `⏰ Alerta: ${product.name} - Por Vencer`;
    } else if (alert.alert_type === 'low_stock') {
      html = getLowStockTemplate(product, product.total_stock || 0, product.min_stock || 0);
      subject = `📉 Alerta: ${product.name} - Stock Bajo`;
    } else {
      html = `<h2>${alert.message}</h2><p>Producto: ${product.name}</p>`;
      subject = `Alerta: ${product.name}`;
    }
    
    const result = await sendEmail(email, subject, html);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Notificación enviada correctamente'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Error al enviar notificación'
      });
    }
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    res.status(500).json({
      success: false,
      error: `Error al enviar notificación: ${error.message}`
    });
  }
});

/**
 * POST /api/notifications/send-daily-summary
 * Enviar resumen diario de alertas
 */
router.post('/send-daily-summary', authenticateToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Lista de emails requerida'
      });
    }
    
    // Obtener todas las alertas activas
    const alerts = await db.getActiveAlerts();
    
    const html = getDailyAlertsSummaryTemplate(alerts);
    const subject = `📊 Resumen Diario de Alertas - ${new Date().toLocaleDateString('es-ES')}`;
    
    const results = await Promise.all(
      emails.map(email => sendEmail(email, subject, html))
    );
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    res.json({
      success: true,
      message: `Resumen enviado a ${successCount} de ${emails.length} destinatarios`,
      details: {
        success: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    console.error('Error al enviar resumen diario:', error);
    res.status(500).json({
      success: false,
      error: `Error al enviar resumen: ${error.message}`
    });
  }
});

/**
 * GET /api/notifications/preferences
 * Obtener preferencias de notificaciones del usuario actual
 */
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Por ahora, retornamos preferencias por defecto
    // En el futuro, esto podría almacenarse en la base de datos por usuario
    const defaultPreferences = {
      alert_expired_enabled: true,
      alert_expired_email: true,
      alert_expiring_soon_enabled: true,
      alert_expiring_soon_email: true,
      alert_low_stock_enabled: true,
      alert_low_stock_email: true,
      alert_prediction_insufficient_enabled: true,
      alert_prediction_insufficient_email: true
    };
    
    // TODO: Obtener preferencias desde la base de datos si existe tabla user_notification_preferences
    // Por ahora, retornamos las preferencias por defecto
    
    res.json({
      success: true,
      data: defaultPreferences
    });
  } catch (error) {
    console.error('Error al obtener preferencias:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener preferencias: ${error.message}`
    });
  }
});

/**
 * PUT /api/notifications/preferences
 * Actualizar preferencias de notificaciones del usuario actual
 */
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;
    
    // Validar que las preferencias sean válidas
    const validKeys = [
      'alert_expired_enabled',
      'alert_expired_email',
      'alert_expiring_soon_enabled',
      'alert_expiring_soon_email',
      'alert_low_stock_enabled',
      'alert_low_stock_email',
      'alert_prediction_insufficient_enabled',
      'alert_prediction_insufficient_email'
    ];
    
    const updatedPreferences = {};
    validKeys.forEach(key => {
      if (preferences.hasOwnProperty(key)) {
        updatedPreferences[key] = Boolean(preferences[key]);
      }
    });
    
    // TODO: Guardar preferencias en la base de datos si existe tabla user_notification_preferences
    // Por ahora, solo retornamos éxito
    
    res.json({
      success: true,
      message: 'Preferencias actualizadas correctamente',
      data: updatedPreferences
    });
  } catch (error) {
    console.error('Error al actualizar preferencias:', error);
    res.status(500).json({
      success: false,
      error: `Error al actualizar preferencias: ${error.message}`
    });
  }
});

module.exports = router;

