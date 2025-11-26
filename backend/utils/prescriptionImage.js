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
 * Generar imagen de receta médica con formato institucional
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
    receipt_number,
    patient_name,
    patient_id_number,
    patient_phone,
    doctor_name,
    doctor_license,
    prescription_date,
    specialty,
    service,
    attention_type,
    items = [],
    notes
  } = prescriptionData;

  // Configuración del canvas
  const width = options.width || 800;
  const baseHeight = 1200;
  const itemHeight = 180; // Altura estimada por medicamento
  const height = Math.max(baseHeight, baseHeight + (items.length - 2) * itemHeight);
  const padding = 40;
  const lineHeight = 28;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fondo blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  let y = padding;

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCABEZADO - DATOS GENERALES DEL DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  // Título principal
  ctx.fillStyle = '#1a365d';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('RECETA MÉDICA', width / 2, y);
  y += lineHeight * 1.5;

  // Subtítulo
  ctx.font = '16px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.fillText('Orden de Medicamentos', width / 2, y);
  y += lineHeight * 2;

  // Línea separadora
  ctx.strokeStyle = '#2b6cb0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight;

  // Datos del documento en dos columnas
  ctx.textAlign = 'left';
  ctx.font = '14px Arial';
  const col1X = padding;
  const col2X = width / 2 + 20;

  // Columna 1
  ctx.fillStyle = '#718096';
  ctx.fillText('Especialidad:', col1X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(specialty || 'General', col1X + 85, y);
  
  // Columna 2
  ctx.font = '14px Arial';
  ctx.fillStyle = '#718096';
  ctx.fillText('N° Orden:', col2X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(receipt_number || prescription_code || 'N/A', col2X + 70, y);
  y += lineHeight;

  // Servicio y Fecha
  ctx.font = '14px Arial';
  ctx.fillStyle = '#718096';
  ctx.fillText('Servicio:', col1X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(service || 'Farmacia Consulta Externa', col1X + 60, y);

  ctx.font = '14px Arial';
  ctx.fillStyle = '#718096';
  ctx.fillText('Fecha:', col2X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  const formattedDate = prescription_date 
    ? new Date(prescription_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  ctx.fillText(formattedDate, col2X + 50, y);
  y += lineHeight;

  // Tipo de atención
  ctx.font = '14px Arial';
  ctx.fillStyle = '#718096';
  ctx.fillText('Tipo Atención:', col1X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(attention_type || 'Consulta Externa', col1X + 95, y);
  y += lineHeight * 1.5;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECCIÓN PACIENTE
  // ═══════════════════════════════════════════════════════════════════════════

  // Fondo de sección
  ctx.fillStyle = '#ebf8ff';
  ctx.fillRect(padding - 10, y - 5, width - (padding * 2) + 20, lineHeight * 3 + 15);

  ctx.fillStyle = '#2b6cb0';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('DATOS DEL PACIENTE', col1X, y + lineHeight * 0.7);
  y += lineHeight * 1.3;

  ctx.font = '14px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.fillText('Nombre:', col1X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(patient_name || '___________________________', col1X + 60, y);
  y += lineHeight;

  ctx.font = '14px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.fillText('DNI:', col1X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(patient_id_number || '_______________', col1X + 35, y);

  ctx.font = '14px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.fillText('Teléfono:', col2X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(patient_phone || '_______________', col2X + 65, y);
  y += lineHeight * 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECCIÓN MEDICAMENTOS
  // ═══════════════════════════════════════════════════════════════════════════

  ctx.fillStyle = '#1a365d';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('MEDICAMENTOS INDICADOS', col1X, y);
  y += lineHeight * 1.2;

  // Línea bajo título
  ctx.strokeStyle = '#2b6cb0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 0.8;

  if (items && items.length > 0) {
    items.forEach((item, index) => {
      // Fondo alternado para cada medicamento
      if (index % 2 === 0) {
        ctx.fillStyle = '#f7fafc';
        ctx.fillRect(padding - 10, y - 10, width - (padding * 2) + 20, itemHeight - 20);
      }

      // Número y nombre del medicamento
      ctx.fillStyle = '#2b6cb0';
      ctx.font = 'bold 16px Arial';
      const itemLetter = String.fromCharCode(65 + index); // A, B, C...
      ctx.fillText(`${itemLetter})`, col1X, y + 5);
      
      ctx.fillStyle = '#1a202c';
      ctx.font = 'bold 15px Arial';
      const productName = item.product_name || 'Medicamento';
      const concentration = item.concentration ? ` ${item.concentration}` : '';
      ctx.fillText(`${productName}${concentration}`, col1X + 25, y + 5);
      y += lineHeight * 1.2;

      // Detalles del medicamento en grid
      const detailX = col1X + 25;
      ctx.font = '13px Arial';

      // Fila 1: Cantidad y Vía
      ctx.fillStyle = '#718096';
      ctx.fillText('Cantidad:', detailX, y);
      ctx.fillStyle = '#1a202c';
      ctx.font = 'bold 13px Arial';
      const qty = item.quantity_required || 0;
      ctx.fillText(`${qty} unidades`, detailX + 65, y);

      ctx.font = '13px Arial';
      ctx.fillStyle = '#718096';
      ctx.fillText('Vía:', detailX + 200, y);
      ctx.fillStyle = '#1a202c';
      ctx.font = 'bold 13px Arial';
      ctx.fillText(item.administration_route || 'Oral', detailX + 230, y);
      y += lineHeight;

      // Fila 2: Dosis y Duración
      ctx.font = '13px Arial';
      ctx.fillStyle = '#718096';
      ctx.fillText('Dosis:', detailX, y);
      ctx.fillStyle = '#1a202c';
      ctx.font = 'bold 13px Arial';
      ctx.fillText(item.dosage || item.instructions || '_______________', detailX + 45, y);

      ctx.font = '13px Arial';
      ctx.fillStyle = '#718096';
      ctx.fillText('Duración:', detailX + 300, y);
      ctx.fillStyle = '#1a202c';
      ctx.font = 'bold 13px Arial';
      ctx.fillText(item.duration || '_______________', detailX + 360, y);
      y += lineHeight;

      // Fila 3: Código (si existe)
      if (item.item_code) {
        ctx.font = '12px Arial';
        ctx.fillStyle = '#718096';
        ctx.fillText('Código:', detailX, y);
        ctx.fillStyle = '#1a202c';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(item.item_code, detailX + 55, y);
        y += lineHeight;
      }

      // Instrucciones adicionales
      if (item.instructions && item.instructions !== item.dosage) {
        ctx.font = 'italic 12px Arial';
        ctx.fillStyle = '#4a5568';
        const instructionsText = `Indicaciones: ${item.instructions}`;
        y = wrapText(ctx, instructionsText, detailX, y, width - detailX - padding - 20, 12) + 8;
      }

      y += lineHeight * 0.8;
    });
  } else {
    ctx.font = 'italic 14px Arial';
    ctx.fillStyle = '#718096';
    ctx.fillText('No hay medicamentos registrados', col1X, y);
    y += lineHeight * 2;
  }

  y += lineHeight;

  // ═══════════════════════════════════════════════════════════════════════════
  // SECCIÓN MÉDICO Y FIRMA
  // ═══════════════════════════════════════════════════════════════════════════

  // Línea separadora
  ctx.strokeStyle = '#cbd5e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight * 1.5;

  ctx.fillStyle = '#1a365d';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('MÉDICO RESPONSABLE', col1X, y);
  y += lineHeight * 1.2;

  ctx.font = '14px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.fillText('Nombre:', col1X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(doctor_name || '___________________________', col1X + 60, y);
  y += lineHeight;

  ctx.font = '14px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.fillText('Colegiatura:', col1X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(doctor_license || '_______________', col1X + 80, y);

  ctx.font = '14px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.fillText('Especialidad:', col2X, y);
  ctx.fillStyle = '#1a202c';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(specialty || '_______________', col2X + 90, y);
  y += lineHeight * 2.5;

  // Línea de firma
  ctx.strokeStyle = '#1a202c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const signatureWidth = 200;
  const signatureX = (width - signatureWidth) / 2;
  ctx.moveTo(signatureX, y);
  ctx.lineTo(signatureX + signatureWidth, y);
  ctx.stroke();
  y += lineHeight * 0.8;

  ctx.font = '12px Arial';
  ctx.fillStyle = '#4a5568';
  ctx.textAlign = 'center';
  ctx.fillText('Firma y Sello del Médico', width / 2, y);
  y += lineHeight * 2;

  // ═══════════════════════════════════════════════════════════════════════════
  // PIE DE PÁGINA - CÓDIGO QR Y CÓDIGO DE RECETA
  // ═══════════════════════════════════════════════════════════════════════════

  // Línea separadora final
  ctx.strokeStyle = '#2b6cb0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, y);
  ctx.lineTo(width - padding, y);
  ctx.stroke();
  y += lineHeight;

  // Código de receta centrado
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#2b6cb0';
  ctx.textAlign = 'center';
  ctx.fillText(`CÓDIGO: ${prescription_code || 'N/A'}`, width / 2, y);
  y += lineHeight;

  // Nota sobre el QR
  ctx.font = '11px Arial';
  ctx.fillStyle = '#718096';
  ctx.fillText('Escanee el código QR para verificar la autenticidad de esta receta', width / 2, y);
  y += lineHeight;

  // Fecha y hora de generación
  const now = new Date();
  const printDateTime = now.toLocaleDateString('es-ES') + ' - ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  ctx.font = '10px Arial';
  ctx.fillStyle = '#a0aec0';
  ctx.fillText(`Impreso: ${printDateTime}`, width / 2, y);

  // Convertir a buffer
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
      currentY += fontSize + 6;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
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
