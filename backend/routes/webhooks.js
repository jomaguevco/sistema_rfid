const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const crypto = require('crypto');

/**
 * POST /api/webhooks/register
 * Registrar un nuevo webhook
 */
router.post('/register', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { url, events, secret } = req.body;
    
    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'URL y eventos son requeridos'
      });
    }
    
    // Validar URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }
    
    // Generar secret si no se proporciona
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');
    
    // Guardar webhook (en una tabla de webhooks si existe, o en memoria para esta implementación básica)
    // Por ahora, retornamos el webhook registrado
    const webhook = {
      id: Date.now(),
      url,
      events,
      secret: webhookSecret,
      is_active: true,
      created_at: new Date()
    };
    
    res.status(201).json({
      success: true,
      data: {
        ...webhook,
        secret: webhookSecret // Solo mostrar una vez
      }
    });
  } catch (error) {
    console.error('Error al registrar webhook:', error);
    res.status(500).json({
      success: false,
      error: `Error al registrar webhook: ${error.message}`
    });
  }
});

/**
 * POST /api/webhooks/test
 * Probar un webhook
 */
router.post('/test', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { url, event, payload } = req.body;
    
    if (!url || !event) {
      return res.status(400).json({
        success: false,
        error: 'URL y evento son requeridos'
      });
    }
    
    // Enviar webhook
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': new Date().toISOString()
      },
      body: JSON.stringify(payload || { test: true })
    });
    
    res.json({
      success: true,
      data: {
        status: response.status,
        statusText: response.statusText,
        sent: true
      }
    });
  } catch (error) {
    console.error('Error al probar webhook:', error);
    res.status(500).json({
      success: false,
      error: `Error al probar webhook: ${error.message}`
    });
  }
});

module.exports = router;

