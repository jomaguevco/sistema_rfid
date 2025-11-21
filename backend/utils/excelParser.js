const XLSX = require('xlsx');

/**
 * Parsear archivo Excel
 */
function parseExcel(buffer, sheetName = null) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Si no se especifica hoja, usar la primera
    const sheet = sheetName 
      ? workbook.Sheets[sheetName] 
      : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!sheet) {
      throw new Error(`Hoja "${sheetName || workbook.SheetNames[0]}" no encontrada`);
    }
    
    // Convertir a JSON
    const data = XLSX.utils.sheet_to_json(sheet);
    return data;
  } catch (error) {
    throw new Error(`Error al parsear Excel: ${error.message}`);
  }
}

/**
 * Obtener nombres de hojas del archivo Excel
 */
function getSheetNames(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames;
  } catch (error) {
    throw new Error(`Error al leer Excel: ${error.message}`);
  }
}

/**
 * Crear archivo Excel desde datos
 */
function createExcel(data, sheetName = 'Datos') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  parseExcel,
  getSheetNames,
  createExcel
};

