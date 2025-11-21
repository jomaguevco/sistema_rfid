const csv = require('csv-parser');
const { Readable } = require('stream');

/**
 * Parsear archivo CSV
 */
function parseCSV(csvContent) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

/**
 * Validar datos de productos desde CSV
 */
function validateProductData(row, index) {
  const errors = [];
  const warnings = [];
  
  // Campos requeridos
  if (!row.name || row.name.trim() === '') {
    errors.push(`Fila ${index + 1}: El nombre del producto es requerido`);
  }
  
  if (!row.product_type || !['medicamento', 'insumo'].includes(row.product_type.toLowerCase())) {
    errors.push(`Fila ${index + 1}: El tipo debe ser 'medicamento' o 'insumo'`);
  }
  
  // Validar campos numéricos
  if (row.min_stock && isNaN(parseInt(row.min_stock))) {
    warnings.push(`Fila ${index + 1}: min_stock debe ser un número, se usará 0`);
  }
  
  // Validar booleanos
  if (row.requires_refrigeration && !['true', 'false', '1', '0', 'yes', 'no'].includes(row.requires_refrigeration.toLowerCase())) {
    warnings.push(`Fila ${index + 1}: requires_refrigeration debe ser true/false, se usará false`);
  }
  
  return { errors, warnings };
}

/**
 * Normalizar datos de producto desde CSV
 */
function normalizeProductData(row) {
  return {
    name: row.name ? row.name.trim() : '',
    description: row.description ? row.description.trim() : null,
    product_type: row.product_type ? row.product_type.toLowerCase() : 'medicamento',
    active_ingredient: row.active_ingredient ? row.active_ingredient.trim() : null,
    concentration: row.concentration ? row.concentration.trim() : null,
    presentation: row.presentation ? row.presentation.trim() : null,
    administration_route: row.administration_route ? row.administration_route.trim() : null,
    category_id: row.category_id ? parseInt(row.category_id) : null,
    min_stock: row.min_stock ? parseInt(row.min_stock) || 0 : 0,
    requires_refrigeration: ['true', '1', 'yes'].includes((row.requires_refrigeration || '').toLowerCase())
  };
}

/**
 * Validar datos de lotes desde CSV
 */
function validateBatchData(row, index) {
  const errors = [];
  const warnings = [];
  
  if (!row.product_id && !row.product_name) {
    errors.push(`Fila ${index + 1}: Se requiere product_id o product_name`);
  }
  
  if (!row.lot_number || row.lot_number.trim() === '') {
    errors.push(`Fila ${index + 1}: El número de lote es requerido`);
  }
  
  if (!row.expiry_date) {
    errors.push(`Fila ${index + 1}: La fecha de vencimiento es requerida`);
  } else {
    const date = new Date(row.expiry_date);
    if (isNaN(date.getTime())) {
      errors.push(`Fila ${index + 1}: Fecha de vencimiento inválida: ${row.expiry_date}`);
    }
  }
  
  if (!row.quantity || isNaN(parseInt(row.quantity))) {
    errors.push(`Fila ${index + 1}: La cantidad debe ser un número`);
  }
  
  return { errors, warnings };
}

/**
 * Normalizar datos de lote desde CSV
 */
function normalizeBatchData(row) {
  return {
    product_id: row.product_id ? parseInt(row.product_id) : null,
    product_name: row.product_name ? row.product_name.trim() : null,
    lot_number: row.lot_number ? row.lot_number.trim() : '',
    expiry_date: row.expiry_date ? new Date(row.expiry_date).toISOString().split('T')[0] : null,
    quantity: row.quantity ? parseInt(row.quantity) : 0,
    entry_date: row.entry_date ? new Date(row.entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    rfid_uid: row.rfid_uid ? row.rfid_uid.trim() : null
  };
}

/**
 * Generar CSV desde datos
 */
function generateCsv(data) {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Encabezados
  csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
  
  // Datos
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) {
        return '""';
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

module.exports = {
  parseCSV,
  validateProductData,
  normalizeProductData,
  validateBatchData,
  normalizeBatchData,
  generateCsv
};

