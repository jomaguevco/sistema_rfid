let createCanvas, registerFont;
let canvasAvailable = false;

try {
  const canvas = require('canvas');
  createCanvas = canvas.createCanvas;
  registerFont = canvas.registerFont;
  canvasAvailable = true;
} catch (error) {
  console.warn('⚠️  Módulo canvas no disponible. La generación de imágenes de recetas estará deshabilitada.');
  console.warn('   Para habilitarla, ejecuta: npm rebuild canvas');
  canvasAvailable = false;
}

/**
 * Generar imagen de receta médica
 * @param {Object} prescriptionData - Datos de la receta
 * @param {Object} options - Opciones de generación
 * @returns {Promise<Buffer>} - Buffer de la imagen PNG
 */
async function generatePrescriptionImage(prescriptionData, options = {}) {
  if (!canvasAvailable) {
    throw new Error('El módulo canvas no está disponible. Por favor ejecuta: npm rebuild canvas');
  }

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
  const height = options.height || 1600;
  const padding = 40;
  const lineHeight = 45;
  const titleSize = 36;
  const headingSize = 26;
  const bodySize = 20;
  const smallSize = 16;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fondo blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Configurar fuente (usar fuente por defecto del sistema)
  let y = padding;

  // Título principal
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold ${titleSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('RECETA MÉDICA', width / 2, y);
  y += lineHeight * 2;

  // Línea separadora (más suave)
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 2;

  // Código de receta
  ctx.font = `bold ${headingSize}px Arial`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2c3e50';
  if (prescription_code) {
    ctx.fillText(`Código: ${prescription_code}`, padding, y);
    y += lineHeight * 1.2;
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
    ctx.fillStyle = '#555555';
    ctx.fillText(`Fecha: ${formattedDate}`, padding, y);
    y += lineHeight * 2;
  }

  // Separador
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 2;

  // Información del paciente
  ctx.font = `bold ${headingSize}px Arial`;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText('PACIENTE', padding, y);
  y += lineHeight * 1.5;

  ctx.font = `${bodySize}px Arial`;
  ctx.fillStyle = '#2c3e50';
  if (patient_name) {
    ctx.fillText(`Nombre: ${patient_name}`, padding + 20, y);
    y += lineHeight * 1.3;
  }
  if (patient_id_number) {
    ctx.fillText(`DNI: ${patient_id_number}`, padding + 20, y);
    y += lineHeight * 1.3;
  }
  y += lineHeight * 1.5;

  // Información del médico
  ctx.font = `bold ${headingSize}px Arial`;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText('MÉDICO', padding, y);
  y += lineHeight * 1.5;

  ctx.font = `${bodySize}px Arial`;
  ctx.fillStyle = '#2c3e50';
  if (doctor_name) {
    ctx.fillText(`Nombre: ${doctor_name}`, padding + 20, y);
    y += lineHeight * 1.3;
  }
  if (doctor_license) {
    ctx.fillText(`Colegiatura: ${doctor_license}`, padding + 20, y);
    y += lineHeight * 1.3;
  }
  y += lineHeight * 1.5;

  // Separador
  ctx.strokeStyle = '#E0E0E0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 2;

  // Medicamentos
  if (items && items.length > 0) {
    ctx.font = `bold ${headingSize}px Arial`;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText('MEDICAMENTOS', padding, y);
    y += lineHeight * 2;

    ctx.font = `${bodySize}px Arial`;
    ctx.fillStyle = '#2c3e50';

    items.forEach((item, index) => {
      // Número y nombre del medicamento
      ctx.font = `bold ${bodySize + 2}px Arial`;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(`${index + 1}. ${item.product_name || 'Medicamento'}`, padding + 20, y);
      y += lineHeight * 1.5;

      ctx.font = `${smallSize}px Arial`;
      ctx.fillStyle = '#555555';
      const itemPadding = padding + 40;
      const maxWidth = width - itemPadding - padding;

      if (item.active_ingredient) {
        const text = `   Principio Activo: ${item.active_ingredient}`;
        y = wrapText(ctx, text, itemPadding, y, maxWidth, smallSize) + 12;
      }

      if (item.concentration) {
        const text = `   Concentración: ${item.concentration}`;
        y = wrapText(ctx, text, itemPadding, y, maxWidth, smallSize) + 12;
      }

      const qtyText = `   Cantidad Requerida: ${item.quantity_required || 0} unidades`;
      y = wrapText(ctx, qtyText, itemPadding, y, maxWidth, smallSize) + 12;

      if (item.quantity_dispensed !== undefined) {
        const dispensedText = `   Despachado: ${item.quantity_dispensed || 0} unidades`;
        y = wrapText(ctx, dispensedText, itemPadding, y, maxWidth, smallSize) + 12;
      }

      if (item.instructions) {
        const instructionsText = `   Instrucciones: ${item.instructions}`;
        y = wrapText(ctx, instructionsText, itemPadding, y, maxWidth, smallSize) + 12;
      }

      y += lineHeight * 1.2;
    });
  }

  // Notas adicionales
  if (notes) {
    y += lineHeight * 1.5;
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    y += lineHeight * 2;

    ctx.font = `bold ${headingSize}px Arial`;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText('NOTAS', padding, y);
    y += lineHeight * 1.5;

    ctx.font = `${bodySize}px Arial`;
    ctx.fillStyle = '#2c3e50';
    const maxWidth = width - padding * 2;
    y = wrapText(ctx, notes, padding, y, maxWidth, bodySize) + 15;
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
  // Optimizar imagen: convertir a JPEG con calidad 85% para reducir tamaño
  // Si el PNG es muy grande, usar JPEG
  const pngBuffer = canvas.toBuffer('image/png');
  const pngSizeMB = pngBuffer.length / (1024 * 1024);
  
  // Si la imagen PNG es mayor a 1MB, convertir a JPEG con calidad 85%
  if (pngSizeMB > 1) {
    try {
      const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });
      const jpegSizeMB = jpegBuffer.length / (1024 * 1024);
      console.log(`📊 Imagen optimizada: PNG ${pngSizeMB.toFixed(2)}MB → JPEG ${jpegSizeMB.toFixed(2)}MB`);
      return jpegBuffer;
    } catch (error) {
      console.warn('⚠️ No se pudo convertir a JPEG, usando PNG:', error.message);
      return pngBuffer;
    }
  }
  
  return pngBuffer;
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
      currentY += fontSize + 8;
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

