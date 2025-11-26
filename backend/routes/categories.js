const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/categories
 * Obtener todas las categorías
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Log silencioso - solo para debugging si es necesario
    const categories = await db.getAllCategories();
    // Log silencioso - solo mostrar en caso de error
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('✗ Error en GET /api/categories:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/categories/:id
 * Obtener una categoría por ID
 */
router.get('/:id', async (req, res) => {
  try {
    const category = await db.getCategoryById(parseInt(req.params.id));
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Categoría no encontrada'
      });
    }
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/categories
 * Crear una nueva categoría
 */
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la categoría es requerido'
      });
    }
    const category = await db.createCategory({ name: name.trim(), description });
    res.status(201).json({
      success: true,
      data: category,
      message: 'Categoría creada correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una categoría con ese nombre'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/categories/:id
 * Actualizar una categoría (requiere autenticación)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { name, description } = req.body;
    
    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El nombre de la categoría no puede estar vacío'
      });
    }

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
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }
    
    params.push(categoryId);
    
    await db.pool.execute(
      `UPDATE product_categories SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const category = await db.getCategoryById(categoryId);
    res.json({
      success: true,
      data: category,
      message: 'Categoría actualizada correctamente'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una categoría con ese nombre'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/categories/:id
 * Eliminar una categoría (requiere autenticación)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    // Verificar si hay productos asociados
    const [products] = await db.pool.execute(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [categoryId]
    );
    
    if (products[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar la categoría porque tiene ${products[0].count} producto(s) asociado(s)`
      });
    }
    
    await db.pool.execute('DELETE FROM product_categories WHERE id = ?', [categoryId]);
    
    res.json({
      success: true,
      message: 'Categoría eliminada correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

