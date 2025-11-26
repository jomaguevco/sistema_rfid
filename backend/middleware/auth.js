const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database_medical');

// Generar JWT_SECRET seguro si no está configurado
const DEFAULT_JWT_SECRET = crypto.randomBytes(32).toString('hex');

// En producción, JWT_SECRET debe estar configurado explícitamente
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('⚠️  ADVERTENCIA DE SEGURIDAD: JWT_SECRET no está configurado en producción.');
  console.error('   Esto es un riesgo de seguridad. Configure la variable de entorno JWT_SECRET.');
  console.error('   Usando un secreto aleatorio temporal (los tokens no persistirán entre reinicios).');
}

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Log informativo sobre la configuración (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  console.log('🔐 JWT configurado:', process.env.JWT_SECRET ? 'Secreto personalizado' : 'Secreto generado automáticamente');
}

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

