const express = require('express');
const router = express.Router();
const db = require('../database_medical');

/**
 * GET /api/areas
 * Obtener todas las áreas (activas por defecto, todas si ?all=true)
 */
router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true';
    let areas;
    
    if (includeInactive) {
      // Obtener todas las áreas incluyendo inactivas
      const [rows] = await db.pool.execute('SELECT * FROM areas ORDER BY name');
      areas = rows;
    } else {
      // Solo áreas activas (comportamiento por defecto)
      areas = await db.getAllAreas();
    }
    
    res.json({
      success: true,
      data: areas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/areas/:id
 * Obtener un área por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const area = await db.getAreaById(parseInt(req.params.id));
    if (!area) {
      return res.status(404).json({
        success: false,
        error: 'Área no encontrada'
      });
    }
    res.json({
      success: true,
      data: area
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/areas
 * Crear un nuevo área
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, is_active } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del área es requerido'
      });
    }
    const area = await db.createArea({ 
      name: name.trim(), 
      description: description || null,
      is_active: is_active !== undefined ? is_active : true
    });
    res.status(201).json({
      success: true,
      data: area,
      message: 'Área creada correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un área con ese nombre'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/areas/:id
 * Actualizar un área
 */
router.put('/:id', async (req, res) => {
  try {
    const areaId = parseInt(req.params.id);
    const { name, description, is_active } = req.body;
    
    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre del área no puede estar vacío'
      });
    }

    // Construir query dinámicamente
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    params.push(areaId);
    
    await db.pool.execute(
      `UPDATE areas SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const area = await db.getAreaById(areaId);
    res.json({
      success: true,
      data: area,
      message: 'Área actualizada correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un área con ese nombre'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/areas/:id
 * Eliminar un área
 */
router.delete('/:id', async (req, res) => {
  try {
    const areaId = parseInt(req.params.id);
    
    // Verificar si hay historial asociado
    const [history] = await db.pool.execute(
      'SELECT COUNT(*) as count FROM stock_history WHERE area_id = ?',
      [areaId]
    );
    
    if (history[0].count > 0) {
      // Si hay historial, solo desactivar
      await db.pool.execute(
        'UPDATE areas SET is_active = FALSE WHERE id = ?',
        [areaId]
      );
      return res.json({
        success: true,
        message: 'Área desactivada (tiene historial asociado)'
      });
    }
    
    // Si no hay historial, eliminar
    await db.pool.execute('DELETE FROM areas WHERE id = ?', [areaId]);
    
    res.json({
      success: true,
      message: 'Área eliminada correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

