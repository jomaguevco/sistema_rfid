/**
 * Middleware para forzar HTTPS en producción
 */
function enforceHTTPS(req, res, next) {
  // Solo en producción
  if (process.env.NODE_ENV === 'production') {
    // Verificar si la request viene por HTTP
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
  }
  next();
}

module.exports = {
  enforceHTTPS
};

