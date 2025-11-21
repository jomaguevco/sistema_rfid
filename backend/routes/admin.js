const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * GET /api/admin/config
 * Obtener todas las configuraciones del sistema
 */
router.get('/config', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM system_config WHERE 1=1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY category, config_key';
    
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
 * GET /api/admin/config/:key
 * Obtener una configuración específica
 */
router.get('/config/:key', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const [rows] = await db.pool.execute(
      'SELECT * FROM system_config WHERE config_key = ?',
      [key]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/config/:key
 * Actualizar una configuración
 */
router.put('/config/:key', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { key } = req.params;
    const { config_value, description } = req.body;
    const userId = req.user.id;
    
    if (config_value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'config_value es requerido'
      });
    }
    
    // Verificar si existe
    const [existing] = await db.pool.execute(
      'SELECT id, is_editable FROM system_config WHERE config_key = ?',
      [key]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }
    
    if (!existing[0].is_editable) {
      return res.status(403).json({
        success: false,
        error: 'Esta configuración no puede ser editada'
      });
    }
    
    await db.pool.execute(
      `UPDATE system_config 
       SET config_value = ?, description = COALESCE(?, description), updated_by = ?, updated_at = NOW()
       WHERE config_key = ?`,
      [config_value, description || null, userId, key]
    );
    
    const [updated] = await db.pool.execute(
      'SELECT * FROM system_config WHERE config_key = ?',
      [key]
    );
    
    res.json({
      success: true,
      data: updated[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/config
 * Crear una nueva configuración
 */
router.post('/config', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { config_key, config_value, config_type, description, category, is_editable } = req.body;
    const userId = req.user.id;
    
    if (!config_key || config_value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'config_key y config_value son requeridos'
      });
    }
    
    const [result] = await db.pool.execute(
      `INSERT INTO system_config (config_key, config_value, config_type, description, category, is_editable, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        config_key,
        config_value,
        config_type || 'string',
        description || null,
        category || 'general',
        is_editable !== undefined ? is_editable : true,
        userId
      ]
    );
    
    const [newConfig] = await db.pool.execute(
      'SELECT * FROM system_config WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      data: newConfig[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una configuración con esta clave'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/scheduled-reports
 * Obtener todos los reportes programados
 */
router.get('/scheduled-reports', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const [rows] = await db.pool.execute(
      `SELECT sr.*, u.username as created_by_username
       FROM scheduled_reports sr
       LEFT JOIN users u ON sr.created_by = u.id
       ORDER BY sr.created_at DESC`
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
 * POST /api/admin/scheduled-reports
 * Crear un nuevo reporte programado
 */
router.post('/scheduled-reports', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const {
      report_name,
      report_type,
      schedule_type,
      schedule_config,
      recipients,
      format,
      filters,
      is_active
    } = req.body;
    const userId = req.user.id;
    
    if (!report_name || !report_type || !schedule_type) {
      return res.status(400).json({
        success: false,
        error: 'report_name, report_type y schedule_type son requeridos'
      });
    }
    
    // Calcular next_run_at basado en schedule_type y schedule_config
    const nextRunAt = calculateNextRun(schedule_type, schedule_config);
    
    const [result] = await db.pool.execute(
      `INSERT INTO scheduled_reports 
       (report_name, report_type, schedule_type, schedule_config, recipients, format, filters, is_active, created_by, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report_name,
        report_type,
        schedule_type,
        JSON.stringify(schedule_config || {}),
        recipients || null,
        format || 'pdf',
        JSON.stringify(filters || {}),
        is_active !== undefined ? is_active : true,
        userId,
        nextRunAt
      ]
    );
    
    const [newReport] = await db.pool.execute(
      `SELECT sr.*, u.username as created_by_username
       FROM scheduled_reports sr
       LEFT JOIN users u ON sr.created_by = u.id
       WHERE sr.id = ?`,
      [result.insertId]
    );
    
    // Programar el reporte
    if (is_active !== false) {
      scheduledReports.scheduleReport(newReport[0]);
    }
    
    res.status(201).json({
      success: true,
      data: newReport[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/scheduled-reports/:id
 * Actualizar un reporte programado
 */
router.put('/scheduled-reports/:id', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      report_name,
      schedule_type,
      schedule_config,
      recipients,
      format,
      filters,
      is_active
    } = req.body;
    
    const updates = [];
    const params = [];
    
    if (report_name !== undefined) {
      updates.push('report_name = ?');
      params.push(report_name);
    }
    if (schedule_type !== undefined) {
      updates.push('schedule_type = ?');
      params.push(schedule_type);
    }
    if (schedule_config !== undefined) {
      updates.push('schedule_config = ?');
      params.push(JSON.stringify(schedule_config));
    }
    if (recipients !== undefined) {
      updates.push('recipients = ?');
      params.push(recipients);
    }
    if (format !== undefined) {
      updates.push('format = ?');
      params.push(format);
    }
    if (filters !== undefined) {
      updates.push('filters = ?');
      params.push(JSON.stringify(filters));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }
    
    // Recalcular next_run_at si cambió schedule_type o schedule_config
    if (schedule_type !== undefined || schedule_config !== undefined) {
      const scheduleType = schedule_type || req.body.original_schedule_type;
      const scheduleConfig = schedule_config || req.body.original_schedule_config;
      const nextRunAt = calculateNextRun(scheduleType, scheduleConfig);
      updates.push('next_run_at = ?');
      params.push(nextRunAt);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    params.push(id);
    
    await db.pool.execute(
      `UPDATE scheduled_reports SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    
    const [updated] = await db.pool.execute(
      `SELECT sr.*, u.username as created_by_username
       FROM scheduled_reports sr
       LEFT JOIN users u ON sr.created_by = u.id
       WHERE sr.id = ?`,
      [id]
    );
    
    // Recargar programación del reporte
    if (updated.length > 0) {
      if (updated[0].is_active) {
        scheduledReports.reloadScheduledReport(id);
      } else {
        scheduledReports.unscheduleReport(id);
      }
    }
    
    res.json({
      success: true,
      data: updated[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/admin/scheduled-reports/:id
 * Eliminar un reporte programado
 */
router.delete('/scheduled-reports/:id', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Desprogramar antes de eliminar
    scheduledReports.unscheduleReport(parseInt(id));
    
    await db.pool.execute('DELETE FROM scheduled_reports WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Reporte programado eliminado'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/scheduled-reports/:id/executions
 * Obtener historial de ejecuciones de un reporte
 */
router.get('/scheduled-reports/:id/executions', authenticateToken, requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const [rows] = await db.pool.execute(
      `SELECT * FROM scheduled_report_executions
       WHERE scheduled_report_id = ?
       ORDER BY execution_date DESC
       LIMIT ?`,
      [id, limit]
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
 * Función auxiliar para calcular próxima ejecución
 */
function calculateNextRun(scheduleType, scheduleConfig) {
  return scheduledReports.calculateNextRun(scheduleType, scheduleConfig);
}

module.exports = router;

