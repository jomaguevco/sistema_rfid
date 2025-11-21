const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateBarcode, generateBarcodeBuffer } = require('./barcode');

/**
 * Generar etiqueta PDF para un lote
 */
async function generateLabelPDF(batch, product, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: options.size || [100, 50], // mm
        margins: { top: 5, bottom: 5, left: 5, right: 5 }
      });
      
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
      
      // Encabezado
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text(product.name, { align: 'center' });
      
      // Información del producto
      doc.fontSize(8)
         .font('Helvetica')
         .text(`Lote: ${batch.lot_number}`, { align: 'center' });
      
      if (product.active_ingredient) {
        doc.text(`Principio Activo: ${product.active_ingredient}`, { align: 'center' });
      }
      
      if (product.concentration) {
        doc.text(`Concentración: ${product.concentration}`, { align: 'center' });
      }
      
      // Fecha de vencimiento
      const expiryDate = new Date(batch.expiry_date).toLocaleDateString('es-ES');
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text(`Vence: ${expiryDate}`, { align: 'center' });
      
      // Código de barras o RFID
      if (batch.rfid_uid) {
        doc.fontSize(7)
           .text(`RFID: ${batch.rfid_uid}`, { align: 'center' });
      }
      
      // Footer
      doc.fontSize(6)
         .text(`Cantidad: ${batch.quantity}`, { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generar etiqueta HTML para vista previa
 */
function generateLabelHTML(batch, product, options = {}) {
  const expiryDate = new Date(batch.expiry_date).toLocaleDateString('es-ES');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @media print {
          @page { size: ${options.size || '100mm 50mm'}; margin: 5mm; }
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 5mm;
          width: ${options.size ? options.size.split(' ')[0] : '100mm'};
          height: ${options.size ? options.size.split(' ')[1] : '50mm'};
        }
        .label-header {
          text-align: center;
          font-weight: bold;
          font-size: 10pt;
          margin-bottom: 2mm;
        }
        .label-info {
          text-align: center;
          font-size: 8pt;
          margin: 1mm 0;
        }
        .label-expiry {
          text-align: center;
          font-weight: bold;
          font-size: 9pt;
          color: #d32f2f;
          margin: 2mm 0;
        }
        .label-rfid {
          text-align: center;
          font-size: 7pt;
          margin: 1mm 0;
        }
        .barcode {
          text-align: center;
          margin: 2mm 0;
        }
      </style>
    </head>
    <body>
      <div class="label-header">${escapeHtml(product.name)}</div>
      <div class="label-info">Lote: ${escapeHtml(batch.lot_number)}</div>
      ${product.active_ingredient ? `<div class="label-info">Principio Activo: ${escapeHtml(product.active_ingredient)}</div>` : ''}
      ${product.concentration ? `<div class="label-info">Concentración: ${escapeHtml(product.concentration)}</div>` : ''}
      <div class="label-expiry">Vence: ${expiryDate}</div>
      ${batch.rfid_uid ? `<div class="label-rfid">RFID: ${escapeHtml(batch.rfid_uid)}</div>` : ''}
      <div class="label-info">Cantidad: ${batch.quantity}</div>
      ${batch.rfid_uid ? `<div class="barcode"><div style="font-family: monospace; font-size: 10pt; text-align: center; padding: 5px; border: 1px solid #333;">${escapeHtml(batch.rfid_uid)}</div></div>` : ''}
    </body>
    </html>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generar múltiples etiquetas PDF
 */
async function generateMultipleLabelsPDF(batches, products, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 10, bottom: 10, left: 10, right: 10 }
      });
      
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
      
      const labelsPerRow = options.labelsPerRow || 2;
      const labelWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / labelsPerRow;
      const labelHeight = options.labelHeight || 50;
      
      batches.forEach((batch, index) => {
        const product = products.find(p => p.id === batch.product_id);
        if (!product) return;
        
        const row = Math.floor(index / labelsPerRow);
        const col = index % labelsPerRow;
        
        if (index > 0 && col === 0) {
          doc.addPage();
        }
        
        const x = doc.page.margins.left + (col * labelWidth);
        const y = doc.page.margins.top + (row * labelHeight);
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(product.name, x, y, { width: labelWidth - 10, align: 'center' });
        
        doc.fontSize(8)
           .font('Helvetica')
           .text(`Lote: ${batch.lot_number}`, x, y + 15, { width: labelWidth - 10, align: 'center' });
        
        const expiryDate = new Date(batch.expiry_date).toLocaleDateString('es-ES');
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#d32f2f')
           .text(`Vence: ${expiryDate}`, x, y + 25, { width: labelWidth - 10, align: 'center' });
        
        doc.fillColor('black');
        
        if (batch.rfid_uid) {
          doc.fontSize(7)
             .text(`RFID: ${batch.rfid_uid}`, x, y + 35, { width: labelWidth - 10, align: 'center' });
        }
      });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateLabelPDF,
  generateLabelHTML,
  generateMultipleLabelsPDF
};

