/**
 * Middleware para paginación
 */
function paginate(req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  // Validar límites
  const maxLimit = 100; // Máximo de items por página
  const validLimit = Math.min(Math.max(limit, 1), maxLimit);
  const validPage = Math.max(page, 1);
  const validOffset = (validPage - 1) * validLimit;
  
  req.pagination = {
    page: validPage,
    limit: validLimit,
    offset: validOffset
  };
  
  next();
}

/**
 * Helper para crear respuesta paginada
 */
function createPaginatedResponse(data, total, pagination) {
  return {
    success: true,
    data: data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: total,
      totalPages: Math.ceil(total / pagination.limit),
      hasNext: pagination.page * pagination.limit < total,
      hasPrev: pagination.page > 1
    }
  };
}

module.exports = {
  paginate,
  createPaginatedResponse
};

