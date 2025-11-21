const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { hashPassword } = require('../utils/password');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { logActionManual } = require('../middleware/audit');

/**
 * GET /api/users
 * Obtener todos los usuarios (solo admin)
 */
router.get('/', authenticateToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios'
    });
  }
});

/**
 * GET /api/users/:id
 * Obtener usuario por ID
 */
router.get('/:id', authenticateToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuario'
    });
  }
});

/**
 * PUT /api/users/:id
 * Actualizar usuario
 */
router.put('/:id', authenticateToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { username, email, role, is_active, password } = req.body;

    // Obtener usuario actual para auditoría
    const oldUser = await db.getUserById(userId);
    if (!oldUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (password !== undefined) {
      updateData.password_hash = await hashPassword(password);
    }

    const updatedUser = await db.updateUser(userId, updateData);

    // Registrar en auditoría
    await logActionManual(
      req.userId,
      'UPDATE',
      'users',
      userId,
      oldUser,
      updatedUser,
      req.ip || req.connection.remoteAddress,
      req.get('user-agent')
    );

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar usuario'
    });
  }
});

/**
 * DELETE /api/users/:id
 * Eliminar usuario (desactivar)
 */
router.delete('/:id', authenticateToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // No permitir auto-eliminación
    if (userId === req.userId) {
      return res.status(400).json({
        success: false,
        error: 'No puedes desactivar tu propio usuario'
      });
    }

    const oldUser = await db.getUserById(userId);
    if (!oldUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    await db.deleteUser(userId);

    // Registrar en auditoría
    await logActionManual(
      req.userId,
      'DELETE',
      'users',
      userId,
      oldUser,
      { is_active: false },
      req.ip || req.connection.remoteAddress,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'Usuario desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar usuario'
    });
  }
});

module.exports = router;

