const path = require('path');
const fs = require('fs').promises;
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const csvParser = require('./csvParser');

const REPORTS_DIR = path.join(__dirname, '../../reports');

/**
 * Asegurar que el directorio de reportes existe
 */
async function ensureReportsDir() {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  } catch (error) {
    // Directorio ya existe o error de permisos
  }
}

/**
 * Generar reporte y guardarlo en archivo
 */
async function generateReport(reportType, format, data, filters = {}) {
  await ensureReportsDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${reportType}_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
  const filePath = path.join(REPORTS_DIR, filename);
  
  switch (format) {
    case 'csv':
      const csvData = csvParser.generateCsv ? csvParser.generateCsv(data) : '';
      await fs.writeFile(filePath, csvData, 'utf8');
      break;
      
    case 'excel':
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(reportType);
      
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
        worksheet.addRows(data);
      }
      
      await workbook.xlsx.writeFile(filePath);
      break;
      
    case 'pdf':
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);
      
      doc.fontSize(20).text(reportType, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generado: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
      doc.moveDown(2);
      
      if (data.length > 0) {
        doc.fontSize(10);
        let y = doc.y;
        const startX = 50;
        const rowHeight = 20;
        const headers = Object.keys(data[0]).slice(0, 5);
        const colWidth = (doc.page.width - 100) / headers.length;
        
        headers.forEach((header, i) => {
          doc.text(header, startX + i * colWidth, y, { width: colWidth - 5 });
        });
        y += rowHeight;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
        y += 5;
        
        data.slice(0, 50).forEach(row => {
          if (y > doc.page.height - 50) {
            doc.addPage();
            y = 50;
          }
          headers.forEach((header, i) => {
            const value = String(row[header] || '').substring(0, 30);
            doc.text(value, startX + i * colWidth, y, { width: colWidth - 5 });
          });
          y += rowHeight;
        });
      }
      
      doc.end();
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
      break;
      
    case 'json':
      await fs.writeFile(filePath, JSON.stringify({
        report_type: reportType,
        generated_at: new Date().toISOString(),
        filters,
        data
      }, null, 2), 'utf8');
      break;
      
    default:
      throw new Error(`Formato no soportado: ${format}`);
  }
  
  return filePath;
}

module.exports = {
  generateReport,
  ensureReportsDir
};

