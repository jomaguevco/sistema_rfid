const db = require('../database_medical');

/**
 * Middleware para registrar acciones en el log de auditoría
 */
function auditLog(action, tableName) {
  return async (req, res, next) => {
    // Guardar referencia a la función original de res.json
    const originalJson = res.json.bind(res);

    // Interceptar res.json para capturar la respuesta
    res.json = function(data) {
      // Si la acción fue exitosa, registrar en auditoría
      if (data.success !== false && res.statusCode < 400) {
        logAction(req, action, tableName, data).catch(err => {
          console.error('Error al registrar en auditoría:', err);
        });
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Registrar una acción en el log de auditoría
 */
async function logAction(req, action, tableName, responseData) {
  try {
    const userId = req.userId || null;
    const ipAddress = req.ip || req.connection.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    // Obtener record_id de la respuesta si está disponible
    let recordId = null;
    if (responseData && responseData.data) {
      if (responseData.data.id) {
        recordId = responseData.data.id;
      } else if (responseData.data.insertId) {
        recordId = responseData.data.insertId;
      }
    }

    // Obtener valores antiguos y nuevos del body si están disponibles
    let oldValues = null;
    let newValues = null;

    if (req.method === 'POST' || req.method === 'PUT') {
      newValues = JSON.stringify(req.body);
    }

    // Para DELETE, podríamos necesitar obtener los valores antiguos antes de eliminar
    // Esto se manejaría mejor en las rutas específicas

    await db.pool.query(
      `INSERT INTO audit_logs 
       (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, tableName, recordId, oldValues, newValues, ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Error al registrar acción en auditoría:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

/**
 * Registrar acción manualmente (para casos especiales)
 */
async function logActionManual(userId, action, tableName, recordId, oldValues, newValues, ipAddress, userAgent) {
  try {
    await db.pool.query(
      `INSERT INTO audit_logs 
       (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, tableName, recordId, 
       oldValues ? JSON.stringify(oldValues) : null,
       newValues ? JSON.stringify(newValues) : null,
       ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Error al registrar acción manual en auditoría:', error);
    throw error;
  }
}

module.exports = {
  auditLog,
  logAction,
  logActionManual
};

