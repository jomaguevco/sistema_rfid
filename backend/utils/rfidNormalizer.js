/**
 * Utilidades para normalizar códigos RFID
 */

/**
 * Normaliza un código RFID a formato de 7 números
 * @param {string|number} rfid - Código RFID a normalizar
 * @returns {string|null} - Código RFID normalizado (7 números, ej: "2090074") o null si no es válido
 */
function normalizeRfidCode(rfid) {
  if (!rfid) return null
  
  // Convertir a string y remover caracteres no numéricos
  const numericString = String(rfid).replace(/\D/g, '')
  
  if (numericString.length === 0) return null
  
  // Si tiene más de 7 dígitos, tomar los primeros 7
  // Si tiene menos de 7 dígitos, rellenar con ceros a la izquierda
  if (numericString.length > 7) {
    return numericString.substring(0, 7)
  } else if (numericString.length < 7) {
    return numericString.padStart(7, '0')
  }
  
  return numericString
}

/**
 * Valida si un código RFID tiene el formato correcto (7 números)
 * @param {string|number} rfid - Código RFID a validar
 * @returns {boolean} - true si es válido, false si no
 */
function isValidRfidCode(rfid) {
  if (!rfid) return false
  
  const normalized = normalizeRfidCode(rfid)
  return normalized !== null && normalized.length === 7 && /^\d{7}$/.test(normalized)
}

/**
 * Formatea un código RFID para mostrar (normaliza a 7 números)
 * @param {string|number} rfid - Código RFID a formatear
 * @returns {string} - Código RFID formateado o '-' si no es válido
 */
function formatRfidCode(rfid) {
  if (!rfid) return '-'
  
  const normalized = normalizeRfidCode(rfid)
  return normalized || '-'
}

/**
 * Estandariza formato de concentración agregando /5mL si no tiene volumen
 * Solo aplica a medicamentos sin % en la concentración
 * @param {string} concentration - Concentración a formatear
 * @param {string} productType - Tipo de producto ('medicamento' o 'insumo')
 * @returns {string} - Concentración formateada
 */
function formatConcentration(concentration, productType = null) {
  if (!concentration) return null
  
  const trimmed = String(concentration).trim()
  if (!trimmed) return null
  
  // No aplicar a insumos
  if (productType === 'insumo') {
    return trimmed
  }
  
  // No agregar /5mL si tiene % (porcentaje)
  if (trimmed.includes('%')) {
    return trimmed
  }
  
  // Si ya tiene un slash, asumimos que ya tiene volumen
  if (trimmed.includes('/')) {
    return trimmed
  }
  
  // Solo agregar /5mL si es medicamento (o si no se especifica tipo, asumir medicamento)
  if (productType === 'medicamento' || productType === null) {
    return `${trimmed}/5mL`
  }
  
  return trimmed
}

module.exports = {
  normalizeRfidCode,
  isValidRfidCode,
  formatRfidCode,
  formatConcentration
}

