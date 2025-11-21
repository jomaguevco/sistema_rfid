const rateLimit = require('express-rate-limit');

/**
 * Rate limiter general para API (más permisivo para uso normal)
 * Nota: Este limiter se aplica solo a operaciones de escritura (POST, PUT, DELETE)
 * Las operaciones GET están excluidas en server_medical.js
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // máximo 500 requests de escritura por ventana (suficiente para uso normal)
  message: {
    success: false,
    error: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter estricto para autenticación
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por ventana
  message: {
    success: false,
    error: 'Demasiados intentos de inicio de sesión, por favor intenta de nuevo más tarde.'
  },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para operaciones sensibles (crear, actualizar, eliminar)
 */
const sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 operaciones por minuto
  message: {
    success: false,
    error: 'Demasiadas operaciones desde esta IP, por favor espera un momento.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  sensitiveOperationLimiter
};

