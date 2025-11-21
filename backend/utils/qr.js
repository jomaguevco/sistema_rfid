const QRCode = require('qrcode');

/**
 * Generar código QR para una receta
 * @param {string} prescriptionCode - Código de la receta
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} - Data URL del QR (base64)
 */
async function generatePrescriptionQR(prescriptionCode, options = {}) {
  try {
    const qrData = prescriptionCode;
    
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: options.width || 300,
      ...options
    };

    const qrDataURL = await QRCode.toDataURL(qrData, qrOptions);
    return qrDataURL;
  } catch (error) {
    console.error('Error al generar QR:', error);
    throw new Error(`Error al generar código QR: ${error.message}`);
  }
}

/**
 * Generar código QR como buffer (para guardar en archivo)
 * @param {string} prescriptionCode - Código de la receta
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Buffer>} - Buffer del QR
 */
async function generatePrescriptionQRBuffer(prescriptionCode, options = {}) {
  try {
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: options.width || 300,
      ...options
    };

    const qrBuffer = await QRCode.toBuffer(prescriptionCode, qrOptions);
    return qrBuffer;
  } catch (error) {
    console.error('Error al generar QR buffer:', error);
    throw new Error(`Error al generar código QR: ${error.message}`);
  }
}

/**
 * Generar código único de receta
 * @returns {string} - Código en formato REC-YYYY-NNNN
 */
function generatePrescriptionCode() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REC-${year}-${random}`;
}

module.exports = {
  generatePrescriptionQR,
  generatePrescriptionQRBuffer,
  generatePrescriptionCode
};

