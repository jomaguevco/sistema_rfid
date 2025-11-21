const JsBarcode = require('jsbarcode');

// Canvas es opcional - si no está disponible, las funciones retornarán null
let createCanvas = null;
try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
} catch (error) {
  console.warn('⚠️  Módulo canvas no disponible. La generación de códigos de barras estará deshabilitada.');
  console.warn('   Para habilitarla, ejecuta: npm rebuild canvas');
}

/**
 * Generar código de barras como imagen (base64)
 * @param {string} code - Código a codificar
 * @param {string} format - Formato del código (CODE128, CODE39, EAN13, etc.)
 * @param {object} options - Opciones adicionales
 * @returns {string} Data URL de la imagen del código de barras
 */
function generateBarcode(code, format = 'CODE128', options = {}) {
  if (!createCanvas) {
    console.warn('Canvas no disponible. No se puede generar código de barras.');
    return null;
  }
  
  try {
    const canvas = createCanvas(
      options.width || 200,
      options.height || 100
    );
    
    JsBarcode(canvas, code, {
      format: format,
      width: options.barWidth || 2,
      height: options.barHeight || 50,
      displayValue: options.displayValue !== false,
      fontSize: options.fontSize || 12,
      margin: options.margin || 10,
      ...options
    });
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error al generar código de barras:', error);
    return null;
  }
}

/**
 * Generar código de barras como buffer (para PDF)
 * @param {string} code - Código a codificar
 * @param {string} format - Formato del código
 * @param {object} options - Opciones adicionales
 * @returns {Buffer} Buffer de la imagen PNG
 */
function generateBarcodeBuffer(code, format = 'CODE128', options = {}) {
  if (!createCanvas) {
    console.warn('Canvas no disponible. No se puede generar código de barras.');
    return null;
  }
  
  try {
    const canvas = createCanvas(
      options.width || 200,
      options.height || 100
    );
    
    JsBarcode(canvas, code, {
      format: format,
      width: options.barWidth || 2,
      height: options.barHeight || 50,
      displayValue: options.displayValue !== false,
      fontSize: options.fontSize || 12,
      margin: options.margin || 10,
      ...options
    });
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error al generar código de barras:', error);
    return null;
  }
}

/**
 * Validar formato de código de barras
 * @param {string} code - Código a validar
 * @param {string} format - Formato esperado
 * @returns {boolean} True si el código es válido para el formato
 */
function validateBarcode(code, format = 'CODE128') {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Validaciones básicas por formato
  switch (format) {
    case 'CODE128':
      // CODE128 acepta cualquier carácter ASCII
      return code.length > 0 && code.length <= 80;
    
    case 'CODE39':
      // CODE39 solo acepta números, letras mayúsculas y algunos símbolos
      return /^[0-9A-Z\-\.\$\/\+\% ]+$/.test(code);
    
    case 'EAN13':
      // EAN13 debe tener exactamente 13 dígitos
      return /^\d{13}$/.test(code);
    
    case 'EAN8':
      // EAN8 debe tener exactamente 8 dígitos
      return /^\d{8}$/.test(code);
    
    default:
      return code.length > 0;
  }
}

/**
 * Obtener formatos disponibles
 * @returns {string[]} Lista de formatos soportados
 */
function getAvailableFormats() {
  return [
    'CODE128',
    'CODE39',
    'EAN13',
    'EAN8',
    'UPC',
    'ITF14',
    'MSI',
    'pharmacode',
    'codabar'
  ];
}

module.exports = {
  generateBarcode,
  generateBarcodeBuffer,
  validateBarcode,
  getAvailableFormats
};

