const express = require('express');
const router = express.Router();
const db = require('../database_medical');
const { hashPassword, verifyPassword } = require('../utils/password');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { logActionManual } = require('../middleware/audit');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateLogin } = require('../middleware/validation');

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Verificar si el usuario está activo
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Usuario inactivo. Contacta al administrador.'
      });
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken(user.id, user.role);

    // Crear sesión
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

    // Actualizar último login
    try {
      await db.updateLastLogin(user.id);
    } catch (error) {
      console.warn('Error al actualizar último login (no crítico):', error.message);
    }

    // Crear sesión
    try {
      await db.createSession(
        user.id,
        token,
        expiresAt,
        req.ip || req.connection.remoteAddress,
        req.get('user-agent')
      );
    } catch (error) {
      console.warn('Error al crear sesión (no crítico):', error.message);
      // Continuar aunque falle la sesión
    }

    // Registrar en auditoría (no crítico - no debe fallar el login)
    try {
      await logActionManual(
        user.id,
        'LOGIN',
        'users',
        user.id,
        null,
        { login_time: new Date() },
        req.ip || req.connection.remoteAddress,
        req.get('user-agent')
      );
    } catch (error) {
      console.warn('Error al registrar en auditoría (no crítico):', error.message);
      // No lanzar error - el login debe continuar
    }

    // Retornar datos del usuario (sin password_hash)
    const { password_hash, ...userData } = user;

    res.json({
      success: true,
      data: {
        user: userData,
        token,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    console.error('Stack:', error.stack);
    
    // Proporcionar más información sobre el error
    let errorMessage = 'Error al iniciar sesión';
    let errorDetails = null;
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Error de conexión a la base de datos. Verifica que MySQL esté corriendo.';
      errorDetails = error.message;
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = 'Error de autenticación con la base de datos. Verifica las credenciales.';
      errorDetails = 'Credenciales incorrectas en database_medical.js';
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      errorMessage = 'La base de datos no existe. Ejecuta: node backend/verificar_sistema.js';
      errorDetails = error.message;
    } else if (error.message) {
      errorDetails = error.message;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    });
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      await db.deleteSession(token);
    }

    // Registrar en auditoría
    await logActionManual(
      req.userId,
      'LOGOUT',
      'users',
      req.userId,
      null,
      { logout_time: new Date() },
      req.ip || req.connection.remoteAddress,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cerrar sesión'
    });
  }
});

/**
 * GET /api/auth/me
 * Obtener información del usuario actual
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.userId);
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
      error: 'Error al obtener información del usuario'
    });
  }
});

/**
 * POST /api/auth/register
 * Registrar nuevo usuario (solo admin)
 */
router.post('/register', authenticateToken, requirePermission('users.manage'), async (req, res) => {
  try {
    const { username, email, password, role = 'enfermero' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email y contraseña son requeridos'
      });
    }

    // Verificar que el username no exista
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'El username ya está en uso'
      });
    }

    // Verificar que el email no exista
    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'El email ya está en uso'
      });
    }

    // Hashear contraseña
    const password_hash = await hashPassword(password);

    // Crear usuario
    const newUser = await db.createUser({
      username,
      email,
      password_hash,
      role
    });

    // Registrar en auditoría
    await logActionManual(
      req.userId,
      'CREATE',
      'users',
      newUser.id,
      null,
      { username, email, role },
      req.ip || req.connection.remoteAddress,
      req.get('user-agent')
    );

    const { password_hash: _, ...userData } = newUser;

    res.status(201).json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar usuario'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Cambiar contraseña
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Contraseña actual y nueva contraseña son requeridas'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    // Obtener usuario con password_hash
    const user = await db.getUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Contraseña actual incorrecta'
      });
    }

    // Hashear nueva contraseña
    const newPasswordHash = await hashPassword(newPassword);

    // Actualizar contraseña
    await db.updateUser(req.userId, { password_hash: newPasswordHash });

    // Registrar en auditoría
    await logActionManual(
      req.userId,
      'UPDATE',
      'users',
      req.userId,
      null,
      { password_changed: true },
      req.ip || req.connection.remoteAddress,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar contraseña'
    });
  }
});

module.exports = router;

