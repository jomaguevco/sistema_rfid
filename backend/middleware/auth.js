const jwt = require('jsonwebtoken');
const db = require('../database_medical');

const JWT_SECRET = process.env.JWT_SECRET || 'sistema-medico-rfid-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Middleware de autenticación JWT
 */
async function authenticateToken(req, res, next) {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticación requerido'
      });
    }

    // Verificar token
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        console.error('✗ [AUTH] Token inválido:', err.message);
        return res.status(403).json({
          success: false,
          error: 'Token inválido o expirado',
          details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }

      // Verificar que el usuario existe y está activo
      try {
        const [users] = await db.pool.query(
          'SELECT id, username, email, role, is_active FROM users WHERE id = ? AND is_active = TRUE',
          [decoded.userId]
        );

        if (users.length === 0) {
          console.warn(`⚠️  [AUTH] Usuario ${decoded.userId} no encontrado o inactivo`);
          return res.status(403).json({
            success: false,
            error: 'Usuario no encontrado o inactivo',
            details: process.env.NODE_ENV === 'development' ? `Usuario ID: ${decoded.userId}` : undefined
          });
        }

        // Agregar información del usuario al request
        req.user = users[0];
        req.userId = decoded.userId;
        // Log silencioso - solo para debugging si es necesario
        next();
      } catch (dbError) {
        // Manejar errores de conexión de forma más elegante
        if (dbError.code === 'ECONNRESET' || dbError.code === 'PROTOCOL_CONNECTION_LOST' || dbError.code === 'ETIMEDOUT') {
          console.error('⚠️  [DB] Conexión perdida, reintentando...');
          // Reintentar una vez
          try {
            const [retryUsers] = await db.pool.query(
              'SELECT id, username, email, role, is_active FROM users WHERE id = ? AND is_active = TRUE',
              [decoded.userId]
            );
            if (retryUsers.length > 0) {
              req.user = retryUsers[0];
              req.userId = decoded.userId;
              console.log(`✅ Usuario autenticado: ${retryUsers[0].username} (${retryUsers[0].role})`);
              next();
              return;
            }
          } catch (retryError) {
            // Si el reintento falla, devolver error
          }
        }
        // Solo mostrar error esencial, no el stack completo
        console.error('✗ [DB] Error:', dbError.code || 'Desconocido', '-', dbError.message);
        return res.status(500).json({
          success: false,
          error: 'Error al verificar autenticación',
          details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
        });
      }
    });
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error en autenticación'
    });
  }
}

/**
 * Generar token JWT
 */
function generateToken(userId, role) {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Middleware opcional - verifica token pero no falla si no existe
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (!err) {
          try {
            const [users] = await db.pool.query(
              'SELECT id, username, email, role, is_active FROM users WHERE id = ? AND is_active = TRUE',
              [decoded.userId]
            );

            if (users.length > 0) {
              req.user = users[0];
              req.userId = decoded.userId;
            }
          } catch (dbError) {
            // Continuar sin usuario autenticado (errores de conexión se ignoran silenciosamente)
          }
        }
        next();
      });
    } else {
      next();
    }
  } catch (error) {
    next();
  }
}

module.exports = {
  authenticateToken,
  generateToken,
  optionalAuth,
  JWT_SECRET,
  JWT_EXPIRES_IN
};

