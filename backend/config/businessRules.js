/**
 * Reglas de Negocio del Sistema Médico
 * Archivo centralizado de constantes y configuraciones de validación
 */

module.exports = {
  // ═══════════════════════════════════════════════════════════════════════════════
  // RECETAS MÉDICAS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Días de vigencia de una receta médica desde su fecha de emisión
   * Después de este período, la receta no puede ser despachada
   */
  PRESCRIPTION_VALIDITY_DAYS: 30,
  
  /**
   * Estados válidos de una receta
   */
  PRESCRIPTION_STATUSES: {
    PENDING: 'pending',      // Pendiente de despacho
    PARTIAL: 'partial',      // Parcialmente despachada
    FULFILLED: 'fulfilled',  // Completamente despachada
    CANCELLED: 'cancelled'   // Cancelada
  },
  
  /**
   * Estados que permiten despacho
   */
  DISPATCHABLE_STATUSES: ['pending', 'partial'],
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // LOTES Y STOCK
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Días antes del vencimiento para mostrar alerta de "próximo a vencer"
   */
  EXPIRY_WARNING_DAYS: 30,
  
  /**
   * Días antes del vencimiento para considerar como crítico
   */
  EXPIRY_CRITICAL_DAYS: 7,
  
  /**
   * Permitir o no despachar lotes vencidos
   */
  ALLOW_EXPIRED_BATCH_DISPATCH: false,
  
  /**
   * Permitir o no crear lotes con fecha de vencimiento pasada
   */
  ALLOW_PAST_EXPIRY_DATE: false,
  
  /**
   * Stock mínimo por defecto para nuevos productos
   */
  DEFAULT_MIN_STOCK: 10,
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // VALIDACIONES DE CANTIDAD
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Cantidad mínima para operaciones de stock
   */
  MIN_QUANTITY: 1,
  
  /**
   * Cantidad máxima para una sola operación de stock
   */
  MAX_QUANTITY_PER_OPERATION: 10000,
  
  /**
   * Cantidad máxima de items por receta
   */
  MAX_ITEMS_PER_PRESCRIPTION: 20,
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // RFID
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Longitud mínima del código RFID
   */
  RFID_MIN_LENGTH: 4,
  
  /**
   * Longitud máxima del código RFID
   */
  RFID_MAX_LENGTH: 50,
  
  /**
   * Patrón válido para códigos RFID (alfanumérico)
   */
  RFID_PATTERN: /^[A-Za-z0-9-_]+$/,
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // USUARIOS Y ROLES
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Roles del sistema
   */
  ROLES: {
    ADMIN: 'admin',
    MEDICO: 'medico',
    FARMACEUTICO: 'farmaceutico'
  },
  
  /**
   * Roles que pueden crear recetas
   */
  ROLES_CAN_CREATE_PRESCRIPTIONS: ['admin', 'medico'],
  
  /**
   * Roles que pueden despachar recetas
   */
  ROLES_CAN_DISPATCH_PRESCRIPTIONS: ['admin', 'farmaceutico'],
  
  /**
   * Roles que pueden cancelar recetas
   */
  ROLES_CAN_CANCEL_PRESCRIPTIONS: ['admin'],
  
  /**
   * Roles que pueden ver stock
   */
  ROLES_CAN_VIEW_STOCK: ['admin', 'farmaceutico'],
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // MENSAJES DE ERROR
  // ═══════════════════════════════════════════════════════════════════════════════
  
  ERROR_MESSAGES: {
    // Recetas
    PRESCRIPTION_EXPIRED: 'La receta ha vencido (más de {days} días). No se puede despachar.',
    PRESCRIPTION_CANCELLED: 'La receta está cancelada. No se puede despachar.',
    PRESCRIPTION_FULFILLED: 'La receta ya fue completamente despachada.',
    PRESCRIPTION_ALREADY_DISPATCHED: 'No se puede cancelar una receta que ya tiene despachos realizados.',
    PRESCRIPTION_DATE_FUTURE: 'La fecha de la receta no puede ser futura.',
    PRESCRIPTION_NO_ITEMS: 'La receta debe tener al menos un medicamento.',
    PRESCRIPTION_TOO_MANY_ITEMS: 'La receta no puede tener más de {max} medicamentos.',
    
    // Lotes y Stock
    BATCH_EXPIRED: 'El lote está vencido. No se permite despachar medicamentos vencidos.',
    BATCH_EXPIRY_PAST: 'La fecha de vencimiento no puede ser anterior a hoy.',
    BATCH_NOT_FOUND: 'Lote no encontrado para el RFID proporcionado.',
    STOCK_INSUFFICIENT: 'Stock insuficiente. Disponible: {available} unidades.',
    STOCK_NEGATIVE: 'La operación resultaría en stock negativo. No permitido.',
    STOCK_BELOW_MINIMUM: 'Advertencia: El stock quedará por debajo del mínimo ({min} unidades).',
    
    // Cantidades
    QUANTITY_INVALID: 'La cantidad debe ser un número positivo mayor a 0.',
    QUANTITY_EXCEEDS_MAX: 'La cantidad excede el máximo permitido ({max} unidades).',
    QUANTITY_EXCEEDS_REQUIRED: 'La cantidad excede lo requerido en la receta.',
    
    // RFID
    RFID_INVALID_FORMAT: 'El código RFID tiene un formato inválido.',
    RFID_REQUIRED: 'El código RFID es requerido.',
    
    // Productos
    PRODUCT_NOT_FOUND: 'Producto no encontrado.',
    PRODUCT_INACTIVE: 'El producto está inactivo y no puede ser despachado.',
    
    // Permisos
    PERMISSION_DENIED: 'No tienes permiso para realizar esta acción.',
    ROLE_CANNOT_CREATE_PRESCRIPTION: 'Solo médicos y administradores pueden crear recetas.',
    ROLE_CANNOT_DISPATCH: 'Solo farmacéuticos y administradores pueden despachar recetas.',
    ROLE_CANNOT_CANCEL: 'Solo administradores pueden cancelar recetas.'
  },
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // FUNCIONES AUXILIARES
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * Verifica si una receta está vencida
   * @param {Date|string} prescriptionDate - Fecha de la receta
   * @returns {boolean} - true si está vencida
   */
  isPrescriptionExpired(prescriptionDate) {
    const prescDate = new Date(prescriptionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today - prescDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > this.PRESCRIPTION_VALIDITY_DAYS;
  },
  
  /**
   * Calcula los días restantes de vigencia de una receta
   * @param {Date|string} prescriptionDate - Fecha de la receta
   * @returns {number} - Días restantes (negativo si ya venció)
   */
  getPrescriptionRemainingDays(prescriptionDate) {
    const prescDate = new Date(prescriptionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = today - prescDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return this.PRESCRIPTION_VALIDITY_DAYS - diffDays;
  },
  
  /**
   * Verifica si un lote está vencido
   * @param {Date|string} expiryDate - Fecha de vencimiento
   * @returns {boolean} - true si está vencido
   */
  isBatchExpired(expiryDate) {
    if (!expiryDate) return false;
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return expiry < today;
  },
  
  /**
   * Calcula los días hasta el vencimiento de un lote
   * @param {Date|string} expiryDate - Fecha de vencimiento
   * @returns {number} - Días hasta vencimiento (negativo si ya venció)
   */
  getDaysUntilExpiry(expiryDate) {
    if (!expiryDate) return null;
    
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },
  
  /**
   * Obtiene el estado de vencimiento de un lote
   * @param {Date|string} expiryDate - Fecha de vencimiento
   * @returns {string} - 'expired', 'critical', 'warning', 'valid'
   */
  getExpiryStatus(expiryDate) {
    const days = this.getDaysUntilExpiry(expiryDate);
    
    if (days === null) return 'unknown';
    if (days < 0) return 'expired';
    if (days <= this.EXPIRY_CRITICAL_DAYS) return 'critical';
    if (days <= this.EXPIRY_WARNING_DAYS) return 'warning';
    return 'valid';
  },
  
  /**
   * Valida el formato de un código RFID
   * @param {string} rfid - Código RFID
   * @returns {boolean} - true si es válido
   */
  isValidRfidFormat(rfid) {
    if (!rfid || typeof rfid !== 'string') return false;
    
    const trimmed = rfid.trim();
    if (trimmed.length < this.RFID_MIN_LENGTH || trimmed.length > this.RFID_MAX_LENGTH) {
      return false;
    }
    
    return this.RFID_PATTERN.test(trimmed);
  },
  
  /**
   * Formatea un mensaje de error reemplazando placeholders
   * @param {string} message - Mensaje con placeholders {key}
   * @param {Object} params - Objeto con valores para reemplazar
   * @returns {string} - Mensaje formateado
   */
  formatErrorMessage(message, params = {}) {
    let formatted = message;
    for (const [key, value] of Object.entries(params)) {
      formatted = formatted.replace(`{${key}}`, value);
    }
    return formatted;
  }
};

