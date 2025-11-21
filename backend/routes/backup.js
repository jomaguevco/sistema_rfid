const express = require('express');
const router = express.Router();
const path = require('path');
const { generateBackup, listBackups, deleteBackup, getBackupPath, scheduleBackup } = require('../utils/backup');
const { restoreBackup, validateBackup } = require('../utils/restore');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

/**
 * POST /api/backup/create
 * Crear nuevo backup
 */
router.post('/create', authenticateToken, requirePermission('backup.manage'), async (req, res) => {
  try {
    const backup = await generateBackup();
    res.json({
      success: true,
      data: backup,
      message: 'Backup creado correctamente'
    });
  } catch (error) {
    console.error('Error al crear backup:', error);
    res.status(500).json({
      success: false,
      error: `Error al crear backup: ${error.message}`
    });
  }
});

/**
 * GET /api/backup/list
 * Listar todos los backups
 */
router.get('/list', authenticateToken, requirePermission('backup.manage'), async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('Error al listar backups:', error);
    res.status(500).json({
      success: false,
      error: `Error al listar backups: ${error.message}`
    });
  }
});

/**
 * GET /api/backup/download/:filename
 * Descargar backup
 */
router.get('/download/:filename', authenticateToken, requirePermission('backup.manage'), async (req, res) => {
  try {
    const filename = req.params.filename;
    const backupPath = getBackupPath(filename);
    
    // Validar que el archivo existe y está en el directorio de backups
    if (!backupPath.startsWith(path.dirname(getBackupPath('')))) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de archivo inválido'
      });
    }
    
    res.download(backupPath, filename, (err) => {
      if (err) {
        console.error('Error al descargar backup:', err);
        res.status(500).json({
          success: false,
          error: 'Error al descargar backup'
        });
      }
    });
  } catch (error) {
    console.error('Error al descargar backup:', error);
    res.status(500).json({
      success: false,
      error: `Error al descargar backup: ${error.message}`
    });
  }
});

/**
 * POST /api/backup/restore
 * Restaurar backup
 */
router.post('/restore', authenticateToken, requirePermission('backup.manage'), async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de archivo requerido'
      });
    }
    
    const backupPath = getBackupPath(filename);
    
    // Validar backup
    const isValid = await validateBackup(backupPath);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Archivo de backup inválido'
      });
    }
    
    // Restaurar
    await restoreBackup(backupPath);
    
    res.json({
      success: true,
      message: 'Backup restaurado correctamente'
    });
  } catch (error) {
    console.error('Error al restaurar backup:', error);
    res.status(500).json({
      success: false,
      error: `Error al restaurar backup: ${error.message}`
    });
  }
});

/**
 * DELETE /api/backup/:filename
 * Eliminar backup
 */
router.delete('/:filename', authenticateToken, requirePermission('backup.manage'), async (req, res) => {
  try {
    const filename = req.params.filename;
    await deleteBackup(filename);
    
    res.json({
      success: true,
      message: 'Backup eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar backup:', error);
    res.status(500).json({
      success: false,
      error: `Error al eliminar backup: ${error.message}`
    });
  }
});

/**
 * POST /api/backup/schedule
 * Programar backup automático
 */
router.post('/schedule', authenticateToken, requirePermission('backup.manage'), async (req, res) => {
  try {
    const { schedule, type } = req.body;
    
    if (!schedule && !type) {
      return res.status(400).json({
        success: false,
        error: 'schedule (expresión cron) o type (daily/weekly/monthly) es requerido'
      });
    }
    
    let cronSchedule = schedule;
    
    if (type) {
      switch (type) {
        case 'daily':
          cronSchedule = '0 2 * * *'; // Diario a las 2 AM
          break;
        case 'weekly':
          cronSchedule = '0 2 * * 0'; // Semanal domingos a las 2 AM
          break;
        case 'monthly':
          cronSchedule = '0 2 1 * *'; // Mensual día 1 a las 2 AM
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Tipo inválido. Use: daily, weekly, o monthly'
          });
      }
    }
    
    const task = scheduleBackup(cronSchedule, (error, backup) => {
      if (error) {
        console.error('Error en backup programado:', error);
      } else {
        console.log('Backup programado completado:', backup.filename);
      }
    });
    
    res.json({
      success: true,
      message: 'Backup programado correctamente',
      data: {
        schedule: cronSchedule,
        taskId: task.taskId || 'scheduled'
      }
    });
  } catch (error) {
    console.error('Error al programar backup:', error);
    res.status(500).json({
      success: false,
      error: `Error al programar backup: ${error.message}`
    });
  }
});

module.exports = router;

