const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para manejar errores de validación
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Errores de validación',
      details: errors.array()
    });
  }
  next();
};

/**
 * Validaciones para productos
 */
const validateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre del producto es requerido')
    .isLength({ min: 2, max: 255 }).withMessage('El nombre debe tener entre 2 y 255 caracteres'),
  body('product_type')
    .isIn(['medicamento', 'insumo']).withMessage('El tipo de producto debe ser "medicamento" o "insumo"'),
  body('min_stock')
    .optional()
    .isInt({ min: 0 }).withMessage('El stock mínimo debe ser un número entero positivo'),
  body('category_id')
    .optional()
    .isInt({ min: 1 }).withMessage('El ID de categoría debe ser un número entero válido'),
  handleValidationErrors
];

/**
 * Validaciones para lotes
 */
const validateBatch = [
  body('product_id')
    .isInt({ min: 1 }).withMessage('El ID del producto es requerido y debe ser válido'),
  body('lot_number')
    .trim()
    .notEmpty().withMessage('El número de lote es requerido')
    .isLength({ min: 1, max: 100 }).withMessage('El número de lote debe tener entre 1 y 100 caracteres'),
  body('expiry_date')
    .isISO8601().withMessage('La fecha de vencimiento debe ser una fecha válida'),
  body('quantity')
    .isInt({ min: 1 }).withMessage('La cantidad debe ser un número entero positivo'),
  body('entry_date')
    .optional()
    .isISO8601().withMessage('La fecha de ingreso debe ser una fecha válida'),
  body('rfid_uid')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('El UID RFID no puede exceder 50 caracteres'),
  handleValidationErrors
];

/**
 * Validaciones para áreas
 */
const validateArea = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre del área es requerido')
    .isLength({ min: 2, max: 255 }).withMessage('El nombre debe tener entre 2 y 255 caracteres'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('La descripción no puede exceder 1000 caracteres'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('is_active debe ser un valor booleano'),
  handleValidationErrors
];

/**
 * Validaciones para categorías
 */
const validateCategory = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre de la categoría es requerido')
    .isLength({ min: 2, max: 255 }).withMessage('El nombre debe tener entre 2 y 255 caracteres'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('La descripción no puede exceder 1000 caracteres'),
  handleValidationErrors
];

/**
 * Validaciones para autenticación
 */
const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('El nombre de usuario es requerido')
    .isLength({ min: 3, max: 50 }).withMessage('El nombre de usuario debe tener entre 3 y 50 caracteres'),
  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  handleValidationErrors
];

/**
 * Validaciones para proveedores
 */
const validateSupplier = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre del proveedor es requerido')
    .isLength({ min: 2, max: 255 }).withMessage('El nombre debe tener entre 2 y 255 caracteres'),
  body('email')
    .optional()
    .isEmail().withMessage('El email debe ser válido'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('El teléfono no puede exceder 50 caracteres'),
  body('tax_id')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('El NIT/RUC no puede exceder 100 caracteres'),
  handleValidationErrors
];

/**
 * Validaciones para órdenes de compra
 */
const validateOrder = [
  body('supplier_id')
    .isInt({ min: 1 }).withMessage('El ID del proveedor es requerido y debe ser válido'),
  body('order_number')
    .trim()
    .notEmpty().withMessage('El número de orden es requerido')
    .isLength({ min: 1, max: 100 }).withMessage('El número de orden debe tener entre 1 y 100 caracteres'),
  body('order_date')
    .isISO8601().withMessage('La fecha de orden debe ser una fecha válida'),
  body('items')
    .isArray({ min: 1 }).withMessage('Debe incluir al menos un item en la orden'),
  body('items.*.product_id')
    .isInt({ min: 1 }).withMessage('El ID del producto es requerido'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('La cantidad debe ser un número entero positivo'),
  body('items.*.unit_price')
    .isFloat({ min: 0 }).withMessage('El precio unitario debe ser un número positivo'),
  handleValidationErrors
];

/**
 * Validaciones para parámetros de ID
 */
const validateId = [
  param('id')
    .isInt({ min: 1 }).withMessage('El ID debe ser un número entero positivo'),
  handleValidationErrors
];

/**
 * Sanitización de entrada
 */
const sanitizeInput = (req, res, next) => {
  // Función recursiva para sanitizar objetos
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? obj.trim() : obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    }
    
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'string') {
          sanitized[key] = value.trim();
        } else if (typeof value === 'object') {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  };
  
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitize(req.query);
  }
  
  next();
};

module.exports = {
  handleValidationErrors,
  validateProduct,
  validateBatch,
  validateArea,
  validateCategory,
  validateLogin,
  validateSupplier,
  validateOrder,
  validateId,
  sanitizeInput
};

