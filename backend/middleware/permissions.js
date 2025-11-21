const db = require('../database_medical');

/**
 * Middleware para verificar permisos
 */
function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      // Si no hay usuario autenticado, rechazar
      if (!req.user || !req.userId) {
        return res.status(401).json({
          success: false,
          error: 'Autenticación requerida'
        });
      }

      const role = req.user.role;

      // Admin tiene todos los permisos
      if (role === 'admin') {
        return next();
      }

      // Verificar si el rol tiene el permiso
      const [permissions] = await db.pool.query(
        `SELECT p.id FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role = ? AND p.name = ?`,
        [role, permissionName]
      );

      if (permissions.length === 0) {
        return res.status(403).json({
          success: false,
          error: `No tienes permiso para realizar esta acción: ${permissionName}`
        });
      }

      next();
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar permisos'
      });
    }
  };
}

/**
 * Middleware para verificar múltiples permisos (OR)
 */
function requireAnyPermission(...permissionNames) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.userId) {
        return res.status(401).json({
          success: false,
          error: 'Autenticación requerida'
        });
      }

      const role = req.user.role;

      if (role === 'admin') {
        return next();
      }

      const placeholders = permissionNames.map(() => '?').join(',');
      const [permissions] = await db.pool.query(
        `SELECT p.id FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role = ? AND p.name IN (${placeholders})`,
        [role, ...permissionNames]
      );

      if (permissions.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permiso para realizar esta acción'
        });
      }

      next();
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      return res.status(500).json({
        success: false,
        error: 'Error al verificar permisos'
      });
    }
  };
}

module.exports = {
  requirePermission,
  requireAnyPermission
};

