const { createCanvas, registerFont } = require('canvas');
const path = require('path');

/**
 * Generar imagen de receta médica
 * @param {Object} prescriptionData - Datos de la receta
 * @param {Object} options - Opciones de generación
 * @returns {Promise<Buffer>} - Buffer de la imagen PNG
 */
async function generatePrescriptionImage(prescriptionData, options = {}) {
  const {
    prescription_code,
    patient_name,
    patient_id_number,
    doctor_name,
    doctor_license,
    prescription_date,
    items = [],
    notes
  } = prescriptionData;

  // Configuración del canvas
  const width = options.width || 800;
  const height = options.height || 1200;
  const padding = 40;
  const lineHeight = 30;
  const titleSize = 32;
  const headingSize = 24;
  const bodySize = 18;
  const smallSize = 14;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fondo blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Configurar fuente (usar fuente por defecto del sistema)
  let y = padding;

  // Título principal
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${titleSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('RECETA MÉDICA', width / 2, y);
  y += lineHeight * 1.5;

  // Línea separadora
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 1.5;

  // Código de receta
  ctx.font = `bold ${headingSize}px Arial`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#333333';
  if (prescription_code) {
    ctx.fillText(`Código: ${prescription_code}`, padding, y);
    y += lineHeight;
  }

  // Fecha
  if (prescription_date) {
    const date = new Date(prescription_date);
    const formattedDate = date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    ctx.font = `${bodySize}px Arial`;
    ctx.fillText(`Fecha: ${formattedDate}`, padding, y);
    y += lineHeight * 1.5;
  }

  // Separador
  y += lineHeight * 0.5;
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 1.5;

  // Información del paciente
  ctx.font = `bold ${headingSize}px Arial`;
  ctx.fillStyle = '#000000';
  ctx.fillText('PACIENTE', padding, y);
  y += lineHeight;

  ctx.font = `${bodySize}px Arial`;
  ctx.fillStyle = '#333333';
  if (patient_name) {
    ctx.fillText(`Nombre: ${patient_name}`, padding + 20, y);
    y += lineHeight;
  }
  if (patient_id_number) {
    ctx.fillText(`DNI: ${patient_id_number}`, padding + 20, y);
    y += lineHeight;
  }
  y += lineHeight * 0.5;

  // Información del médico
  ctx.font = `bold ${headingSize}px Arial`;
  ctx.fillStyle = '#000000';
  ctx.fillText('MÉDICO', padding, y);
  y += lineHeight;

  ctx.font = `${bodySize}px Arial`;
  ctx.fillStyle = '#333333';
  if (doctor_name) {
    ctx.fillText(`Nombre: ${doctor_name}`, padding + 20, y);
    y += lineHeight;
  }
  if (doctor_license) {
    ctx.fillText(`Colegiatura: ${doctor_license}`, padding + 20, y);
    y += lineHeight;
  }
  y += lineHeight * 0.5;

  // Separador
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 1.5;

  // Medicamentos
  if (items && items.length > 0) {
    ctx.font = `bold ${headingSize}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.fillText('MEDICAMENTOS', padding, y);
    y += lineHeight * 1.2;

    ctx.font = `${bodySize}px Arial`;
    ctx.fillStyle = '#333333';

    items.forEach((item, index) => {
      // Número y nombre del medicamento
      ctx.font = `bold ${bodySize}px Arial`;
      ctx.fillText(`${index + 1}. ${item.product_name || 'Medicamento'}`, padding + 20, y);
      y += lineHeight;

      ctx.font = `${smallSize}px Arial`;
      const itemPadding = padding + 40;
      const maxWidth = width - itemPadding - padding;

      if (item.active_ingredient) {
        const text = `   Principio Activo: ${item.active_ingredient}`;
        y = wrapText(ctx, text, itemPadding, y, maxWidth, smallSize) + 5;
      }

      if (item.concentration) {
        const text = `   Concentración: ${item.concentration}`;
        y = wrapText(ctx, text, itemPadding, y, maxWidth, smallSize) + 5;
      }

      const qtyText = `   Cantidad Requerida: ${item.quantity_required || 0} unidades`;
      y = wrapText(ctx, qtyText, itemPadding, y, maxWidth, smallSize) + 5;

      if (item.quantity_dispensed !== undefined) {
        const dispensedText = `   Despachado: ${item.quantity_dispensed || 0} unidades`;
        y = wrapText(ctx, dispensedText, itemPadding, y, maxWidth, smallSize) + 5;
      }

      if (item.instructions) {
        const instructionsText = `   Instrucciones: ${item.instructions}`;
        y = wrapText(ctx, instructionsText, itemPadding, y, maxWidth, smallSize) + 5;
      }

      y += lineHeight * 0.5;
    });
  }

  // Notas adicionales
  if (notes) {
    y += lineHeight * 0.5;
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    y += lineHeight * 1.5;

    ctx.font = `bold ${headingSize}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.fillText('NOTAS', padding, y);
    y += lineHeight;

    ctx.font = `${bodySize}px Arial`;
    ctx.fillStyle = '#333333';
    const maxWidth = width - padding * 2;
    y = wrapText(ctx, notes, padding, y, maxWidth, bodySize) + 5;
  }

  // Pie de página con código QR mencionado
  y = height - padding - lineHeight * 2;
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 1.5;

  ctx.font = `${smallSize}px Arial`;
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  if (prescription_code) {
    ctx.fillText(`Código QR: ${prescription_code}`, width / 2, y);
  }

  // Convertir a buffer
  return canvas.toBuffer('image/png');
}

/**
 * Función helper para envolver texto en múltiples líneas
 * Retorna la nueva posición Y después de dibujar el texto
 */
function wrapText(ctx, text, x, y, maxWidth, fontSize) {
  ctx.font = `${fontSize}px Arial`;
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += fontSize + 5;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}

/**
 * Calcular altura del texto envuelto
 */
function getTextHeight(ctx, text, maxWidth, fontSize) {
  ctx.font = `${fontSize}px Arial`;
  const words = text.split(' ');
  let line = '';
  let lines = 1;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      line = words[n] + ' ';
      lines++;
    } else {
      line = testLine;
    }
  }

  return lines * (fontSize + 5);
}

/**
 * Generar imagen de receta y retornar como base64
 * @param {Object} prescriptionData - Datos de la receta
 * @param {Object} options - Opciones de generación
 * @returns {Promise<string>} - Data URL base64 de la imagen
 */
async function generatePrescriptionImageBase64(prescriptionData, options = {}) {
  const buffer = await generatePrescriptionImage(prescriptionData, options);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

module.exports = {
  generatePrescriptionImage,
  generatePrescriptionImageBase64
};

