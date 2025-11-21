const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * GET /api/audit/logs
 * Obtener logs de auditoría con filtros
 */
router.get('/logs', authenticateToken, requirePermission('audit.view'), async (req, res) => {
  try {
    const {
      user_id,
      action,
      table_name,
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = req.query;
    
    let query = `
      SELECT 
        al.*,
        u.username,
        u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(parseInt(user_id));
    }
    
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }
    
    if (table_name) {
      query += ' AND al.table_name = ?';
      params.push(table_name);
    }
    
    if (start_date) {
      query += ' AND al.timestamp >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND al.timestamp <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [logs] = await db.pool.query(query, params);
    
    // Contar total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      WHERE 1=1
    `;
    const countParams = [];
    
    if (user_id) {
      countQuery += ' AND al.user_id = ?';
      countParams.push(parseInt(user_id));
    }
    if (action) {
      countQuery += ' AND al.action = ?';
      countParams.push(action);
    }
    if (table_name) {
      countQuery += ' AND al.table_name = ?';
      countParams.push(table_name);
    }
    if (start_date) {
      countQuery += ' AND al.timestamp >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ' AND al.timestamp <= ?';
      countParams.push(end_date);
    }
    
    const [countResult] = await db.pool.query(countQuery, countParams);
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: {
        logs: logs.map(log => {
          // Manejar old_values y new_values que pueden ser strings JSON o ya objetos
          let oldValues = null;
          let newValues = null;
          
          try {
            if (log.old_values) {
              oldValues = typeof log.old_values === 'string' 
                ? JSON.parse(log.old_values) 
                : log.old_values;
            }
          } catch (e) {
            console.warn('Error al parsear old_values:', e);
            oldValues = log.old_values; // Mantener el valor original si falla el parse
          }
          
          try {
            if (log.new_values) {
              newValues = typeof log.new_values === 'string' 
                ? JSON.parse(log.new_values) 
                : log.new_values;
            }
          } catch (e) {
            console.warn('Error al parsear new_values:', e);
            newValues = log.new_values; // Mantener el valor original si falla el parse
          }
          
          return {
            ...log,
            old_values: oldValues,
            new_values: newValues
          };
        }),
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error al obtener logs de auditoría:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener logs: ${error.message || String(error)}`
    });
  }
});

/**
 * GET /api/audit/stats
 * Estadísticas de auditoría
 */
router.get('/stats', authenticateToken, requirePermission('audit.view'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (start_date || end_date) {
      whereClause = 'WHERE ';
      const conditions = [];
      if (start_date) {
        conditions.push('timestamp >= ?');
        params.push(start_date);
      }
      if (end_date) {
        conditions.push('timestamp <= ?');
        params.push(end_date);
      }
      whereClause += conditions.join(' AND ');
    }
    
    // Acciones por tipo
    const [actionsByType] = await db.pool.query(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      ${whereClause}
      GROUP BY action
      ORDER BY count DESC
    `, params);
    
    // Acciones por tabla
    const [actionsByTable] = await db.pool.query(`
      SELECT table_name, COUNT(*) as count
      FROM audit_logs
      ${whereClause}
      GROUP BY table_name
      ORDER BY count DESC
    `, params);
    
    // Acciones por usuario
    const [actionsByUser] = await db.pool.query(`
      SELECT u.username, COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      GROUP BY al.user_id, u.username
      ORDER BY count DESC
      LIMIT 10
    `, params);
    
    // Total de logs
    const [totalResult] = await db.pool.query(`
      SELECT COUNT(*) as total FROM audit_logs ${whereClause}
    `, params);
    
    res.json({
      success: true,
      data: {
        total: totalResult[0].total,
        byAction: actionsByType,
        byTable: actionsByTable,
        byUser: actionsByUser
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de auditoría:', error);
    res.status(500).json({
      success: false,
      error: `Error al obtener estadísticas: ${error.message}`
    });
  }
});

/**
 * GET /api/audit/export
 * Exportar logs a CSV
 */
router.get('/export', authenticateToken, requirePermission('audit.view'), async (req, res) => {
  try {
    const {
      user_id,
      action,
      table_name,
      start_date,
      end_date
    } = req.query;
    
    let query = `
      SELECT 
        al.id,
        al.timestamp,
        u.username,
        al.action,
        al.table_name,
        al.record_id,
        al.ip_address
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(parseInt(user_id));
    }
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }
    if (table_name) {
      query += ' AND al.table_name = ?';
      params.push(table_name);
    }
    if (start_date) {
      query += ' AND al.timestamp >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND al.timestamp <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY al.timestamp DESC LIMIT 10000';
    
    const [logs] = await db.pool.query(query, params);
    
    // Generar CSV
    const headers = ['ID', 'Fecha', 'Usuario', 'Acción', 'Tabla', 'Registro ID', 'IP'];
    const rows = logs.map(log => [
      log.id,
      log.timestamp,
      log.username || 'Sistema',
      log.action,
      log.table_name,
      log.record_id || '',
      log.ip_address || ''
    ]);
    
    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\ufeff' + csv); // BOM para Excel
  } catch (error) {
    console.error('Error al exportar logs:', error);
    res.status(500).json({
      success: false,
      error: `Error al exportar logs: ${error.message}`
    });
  }
});

module.exports = router;

