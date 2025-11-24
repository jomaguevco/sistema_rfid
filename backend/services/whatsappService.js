const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const https = require('https');

// Configuración de medichat
const MEDICHAT_URL = process.env.MEDICHAT_URL || 'http://localhost:3001';
const MEDICHAT_TIMEOUT = 10000; // 10 segundos

// Función helper para hacer peticiones HTTP sin axios
function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = httpModule.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ data: parsed, status: res.statusCode });
        } catch (e) {
          resolve({ data: data, status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(MEDICHAT_TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Servicio para enviar mensajes e imágenes a WhatsApp usando medichat
 */
class WhatsAppService {
  /**
   * Verificar si medichat está conectado
   */
  async isConnected() {
    try {
      const response = await makeHttpRequest(`${MEDICHAT_URL}/health`);
      return response.data?.whatsapp === 'connected';
    } catch (error) {
      console.error('❌ Error al verificar conexión de medichat:', error.message);
      return false;
    }
  }

  /**
   * Enviar mensaje de texto a WhatsApp
   * @param {string} phoneNumber - Número de teléfono (formato: 51987654321 o 987654321)
   * @param {string} message - Mensaje a enviar
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async sendMessage(phoneNumber, message) {
    try {
      // Normalizar número de teléfono (eliminar espacios, guiones, etc.)
      let normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      // Si no tiene código de país, asumir Perú (51)
      if (!normalizedPhone.startsWith('51')) {
        normalizedPhone = '51' + normalizedPhone;
      }
      
      if (!normalizedPhone || normalizedPhone.length < 11) {
        return {
          success: false,
          error: 'Número de teléfono inválido. Debe tener al menos 9 dígitos (con código de país 51 para Perú).'
        };
      }

      // Verificar conexión primero
      const connected = await this.isConnected();
      if (!connected) {
        return {
          success: false,
          error: 'WhatsApp no está conectado. Por favor:\n1. Verifica que medichat esté corriendo en http://localhost:3001\n2. Escanea el código QR de WhatsApp en la ventana de medichat\n3. Espera a ver "WhatsApp conectado exitosamente"'
        };
      }

      // Intentar usar directamente el módulo de WhatsApp si está disponible
      // Si no, usar endpoint HTTP de medichat
      try {
        // Intentar importar directamente el módulo de WhatsApp de medichat
        const medichatPath = process.env.MEDICHAT_PATH || path.join(__dirname, '../../medichat');
        const whatsappHandlerPath = path.join(medichatPath, 'src/whatsapp-baileys.js');
        
        let whatsappHandler = null;
        try {
          // Intentar usar el módulo directamente
          whatsappHandler = require(whatsappHandlerPath);
        } catch (requireError) {
          // Si no se puede importar, continuar con HTTP
          console.log('📡 No se puede importar módulo directamente, usando HTTP');
        }
        
        if (whatsappHandler && whatsappHandler.isConnected && whatsappHandler.isConnected()) {
          // Usar módulo directamente
          const result = await whatsappHandler.sendMessage(normalizedPhone, message);
          if (result) {
            return {
              success: true,
              message: 'Mensaje enviado correctamente'
            };
          } else {
            throw new Error('No se pudo enviar el mensaje');
          }
        } else {
          // Usar HTTP como fallback
          console.log('📡 Usando comunicación HTTP con medichat');
          
          const response = await makeHttpRequest(`${MEDICHAT_URL}/test-send-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              phoneNumber: normalizedPhone,
              message: message
            }
          });

          if (response.data?.success) {
            return {
              success: true,
              message: 'Mensaje enviado correctamente'
            };
          } else {
            const errorMsg = response.data?.error || 'Error al enviar mensaje';
            // Mejorar mensaje de error si es sobre cliente no disponible
            if (errorMsg.includes('Cliente de WhatsApp no está disponible') || errorMsg.includes('no está disponible')) {
              return {
                success: false,
                error: 'WhatsApp no está conectado. Por favor:\n1. Verifica que medichat esté corriendo\n2. Escanea el código QR de WhatsApp\n3. Espera a ver "WhatsApp conectado exitosamente"'
              };
            }
            return {
              success: false,
              error: errorMsg
            };
          }
        }
      } catch (httpError) {
        // Si falla HTTP también, retornar error
        throw httpError;
      }
    } catch (error) {
      console.error('❌ Error al enviar mensaje a WhatsApp:', error.message);
      
      if (error.code === 'ECONNREFUSED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'No se pudo conectar con medichat. Verifica que esté corriendo en ' + MEDICHAT_URL
        };
      }
      
      return {
        success: false,
        error: error.message || 'Error al enviar mensaje'
      };
    }
  }

  /**
   * Enviar imagen a WhatsApp
   * @param {string} phoneNumber - Número de teléfono
   * @param {Buffer|string} imageData - Buffer de imagen o ruta de archivo o base64
   * @param {string} filename - Nombre del archivo
   * @param {string} caption - Texto opcional para la imagen
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async sendImage(phoneNumber, imageData, filename = 'image.png', caption = '') {
    try {
      // Normalizar número de teléfono
      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      if (!normalizedPhone || normalizedPhone.length < 9) {
        return {
          success: false,
          error: 'Número de teléfono inválido'
        };
      }

      // Verificar conexión
      const connected = await this.isConnected();
      if (!connected) {
        return {
          success: false,
          error: 'WhatsApp no está conectado'
        };
      }

      // Convertir imagen a buffer si es necesario
      let imageBuffer;
      if (Buffer.isBuffer(imageData)) {
        imageBuffer = imageData;
      } else if (typeof imageData === 'string') {
        // Si es base64
        if (imageData.startsWith('data:image')) {
          const base64Data = imageData.split(',')[1] || imageData;
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
          // Si es URL, descargar usando http/https nativo
          const urlObj = new URL(imageData);
          const isHttps = urlObj.protocol === 'https:';
          const httpModule = isHttps ? https : http;
          
          imageBuffer = await new Promise((resolve, reject) => {
            const req = httpModule.get(imageData, (res) => {
              const chunks = [];
              res.on('data', (chunk) => chunks.push(chunk));
              res.on('end', () => resolve(Buffer.concat(chunks)));
            });
            req.on('error', reject);
            req.setTimeout(MEDICHAT_TIMEOUT, () => {
              req.destroy();
              reject(new Error('Download timeout'));
            });
          });
        } else {
          // Si es ruta de archivo
          imageBuffer = await fs.readFile(imageData);
        }
      } else {
        return {
          success: false,
          error: 'Formato de imagen no soportado'
        };
      }

      // Intentar usar directamente el módulo de WhatsApp si está disponible
      const medichatPath = process.env.MEDICHAT_PATH || path.join(__dirname, '../../medichat');
      const whatsappHandlerPath = path.join(medichatPath, 'src/whatsapp-baileys.js');
      
      let whatsappHandler = null;
      try {
        whatsappHandler = require(whatsappHandlerPath);
      } catch (requireError) {
        // Si no se puede importar, retornar error
        return {
          success: false,
          error: 'No se puede acceder al módulo de WhatsApp. Verifica que medichat esté disponible.'
        };
      }
      
      if (whatsappHandler && whatsappHandler.isConnected && whatsappHandler.isConnected()) {
        // Usar módulo directamente para enviar imagen
        const result = await whatsappHandler.sendImage(normalizedPhone, imageBuffer, filename);
        if (result) {
          return {
            success: true,
            message: 'Imagen enviada correctamente'
          };
        } else {
          return {
            success: false,
            error: 'No se pudo enviar la imagen'
          };
        }
      } else {
        return {
          success: false,
          error: 'WhatsApp no está conectado en medichat'
        };
      }
    } catch (error) {
      console.error('❌ Error al enviar imagen a WhatsApp:', error.message);
      return {
        success: false,
        error: error.message || 'Error al enviar imagen'
      };
    }
  }

  /**
   * Enviar receta completa a WhatsApp (imagen de receta + QR)
   * @param {string} phoneNumber - Número de teléfono del paciente
   * @param {Object} prescriptionData - Datos de la receta
   * @param {Buffer|string} prescriptionImageData - Imagen de la receta como Buffer o base64
   * @param {Buffer|string} qrImageData - Imagen QR como Buffer o base64
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  async sendPrescription(phoneNumber, prescriptionData, prescriptionImageData, qrImageData) {
    try {
      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      // Verificar conexión primero usando HTTP
      const connected = await this.isConnected();
      if (!connected) {
        return {
          success: false,
          error: 'WhatsApp no está conectado. Por favor:\n1. Verifica que medichat esté corriendo en http://localhost:3001\n2. Escanea el código QR de WhatsApp en la ventana de medichat\n3. Espera a ver "WhatsApp conectado exitosamente"'
        };
      }
      
      // Intentar usar directamente el módulo de WhatsApp si está disponible
      const medichatPath = process.env.MEDICHAT_PATH || path.join(__dirname, '../../medichat');
      const whatsappHandlerPath = path.join(medichatPath, 'src/whatsapp-baileys.js');
      
      let whatsappHandler = null;
      let useDirectModule = false;
      try {
        whatsappHandler = require(whatsappHandlerPath);
        if (whatsappHandler && whatsappHandler.isConnected && whatsappHandler.isConnected()) {
          useDirectModule = true;
        }
      } catch (requireError) {
        console.log('📡 No se puede importar módulo directamente, usando HTTP');
        useDirectModule = false;
      }

      // Si no se puede usar el módulo directamente, usar HTTP
      if (!useDirectModule) {
        return await this.sendPrescriptionViaHTTP(normalizedPhone, prescriptionData, prescriptionImageData, qrImageData);
      }

      // Convertir imagen de receta a buffer si es necesario
      let prescriptionBuffer = null;
      if (prescriptionImageData) {
        if (Buffer.isBuffer(prescriptionImageData)) {
          prescriptionBuffer = prescriptionImageData;
        } else if (typeof prescriptionImageData === 'string') {
          if (prescriptionImageData.startsWith('data:image')) {
            const base64Data = prescriptionImageData.split(',')[1] || prescriptionImageData;
            prescriptionBuffer = Buffer.from(base64Data, 'base64');
          } else {
            prescriptionBuffer = Buffer.from(prescriptionImageData, 'base64');
          }
        }
      }

      // Enviar mensaje inicial simple para "romper el hielo" y evitar bloqueos
      // Usar un mensaje más natural y menos robótico
      try {
        console.log(`📤 [0/4] Enviando mensaje inicial...`);
        const initialMessage = `Hola! Te envío tu receta médica ahora.`;
        await whatsappHandler.sendMessage(normalizedPhone, initialMessage);
        console.log('✅ [0/4] Mensaje inicial enviado correctamente');
        
        // Esperar MUCHO más tiempo antes de enviar imágenes (15-25 segundos)
        // Esto hace que parezca más humano y menos automático
        const initialDelay = 15000 + Math.random() * 10000; // 15-25 segundos
        console.log(`⏳ Esperando ${Math.round(initialDelay/1000)}s antes de enviar imágenes (simulando comportamiento humano)...`);
        await new Promise(resolve => setTimeout(resolve, initialDelay));
      } catch (initialError) {
        console.warn('⚠️ [0/4] No se pudo enviar mensaje inicial:', initialError.message);
        // Continuar de todas formas
      }

      // Enviar imagen de receta primero con caption
      if (prescriptionBuffer) {
        try {
          const caption = `📋 Receta Médica\nCódigo: ${prescriptionData.prescription_code || 'N/A'}`;
          const imageSizeMB = (prescriptionBuffer.length / (1024 * 1024)).toFixed(2);
          console.log(`📤 [1/3] Enviando imagen de receta detallada (${imageSizeMB}MB)...`);
          
          const prescriptionResult = await whatsappHandler.sendImage(
            normalizedPhone,
            prescriptionBuffer,
            `Receta_${prescriptionData.prescription_code || 'receta'}.png`,
            caption
          );
          
          if (prescriptionResult) {
            console.log('✅ [1/4] Imagen de receta detallada enviada correctamente');
            // Esperar MUCHO más tiempo entre imágenes (20-30 segundos)
            // Esto simula el comportamiento humano de esperar antes de enviar otra imagen
            const delay = 20000 + Math.random() * 10000; // 20-30 segundos
            console.log(`⏳ Esperando ${Math.round(delay/1000)}s antes de enviar QR (simulando comportamiento humano)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('❌ [1/3] No se pudo enviar imagen de receta detallada');
            // Si falla la imagen, enviar mensaje de texto con los detalles
            await this.sendPrescriptionAsText(normalizedPhone, prescriptionData, whatsappHandler);
          }
        } catch (prescriptionError) {
          console.error('❌ [1/3] Error al enviar imagen de receta:', prescriptionError.message);
          // Si falla la imagen, enviar mensaje de texto con los detalles
          try {
            await this.sendPrescriptionAsText(normalizedPhone, prescriptionData, whatsappHandler);
          } catch (textError) {
            console.error('❌ Error al enviar receta como texto:', textError.message);
          }
        }
      } else {
        console.warn('⚠️ No hay imagen de receta para enviar, enviando solo como texto');
        // Si no hay imagen, enviar mensaje de texto detallado
        await this.sendPrescriptionAsText(normalizedPhone, prescriptionData, whatsappHandler);
      }

      // Convertir QR a buffer si es necesario
      let qrBuffer = null;
      if (qrImageData) {
        if (Buffer.isBuffer(qrImageData)) {
          qrBuffer = qrImageData;
        } else if (typeof qrImageData === 'string') {
          if (qrImageData.startsWith('data:image')) {
            const base64Data = qrImageData.split(',')[1] || qrImageData;
            qrBuffer = Buffer.from(base64Data, 'base64');
          } else {
            qrBuffer = Buffer.from(qrImageData, 'base64');
          }
        }
      }

      // Enviar QR como segunda imagen
      if (qrBuffer) {
        try {
          const qrSizeMB = (qrBuffer.length / (1024 * 1024)).toFixed(2);
          console.log(`📤 [2/3] Enviando código QR (${qrSizeMB}MB)...`);
          
          const qrResult = await whatsappHandler.sendImage(
            normalizedPhone,
            qrBuffer,
            `QR_${prescriptionData.prescription_code || 'receta'}.png`,
            '📱 Código QR de la receta'
          );
          
          if (qrResult) {
            console.log('✅ [2/4] Código QR enviado correctamente');
            // No enviar más mensajes - las imágenes son autoexplicativas
            // El mensaje de resumen ya fue eliminado anteriormente
          } else {
            console.error('❌ [2/3] No se pudo enviar código QR');
          }
        } catch (qrError) {
          console.error('❌ [2/3] Error al enviar código QR:', qrError.message);
        }
      } else {
        console.warn('⚠️ No hay código QR para enviar');
      }

      // Mensaje de resumen eliminado - las imágenes son autoexplicativas

      return {
        success: true,
        message: 'Receta enviada correctamente a WhatsApp'
      };
    } catch (error) {
      console.error('❌ Error al enviar receta a WhatsApp:', error.message);
      
      // Si falla con módulo directo, intentar con HTTP
      if (error.message?.includes('no está conectado') || error.message?.includes('not connected')) {
        try {
          const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
          return await this.sendPrescriptionViaHTTP(normalizedPhone, prescriptionData, prescriptionImageData, qrImageData);
        } catch (httpError) {
          return {
            success: false,
            error: httpError.message || 'Error al enviar receta'
          };
        }
      }
      
      return {
        success: false,
        error: error.message || 'Error al enviar receta'
      };
    }
  }

  /**
   * Enviar receta usando HTTP como fallback
   */
  async sendPrescriptionViaHTTP(phoneNumber, prescriptionData, prescriptionImageData, qrImageData) {
    try {
      // Convertir imágenes a base64 para enviar por HTTP
      let prescriptionBase64 = null;
      if (prescriptionImageData) {
        if (Buffer.isBuffer(prescriptionImageData)) {
          prescriptionBase64 = prescriptionImageData.toString('base64');
        } else if (typeof prescriptionImageData === 'string') {
          if (prescriptionImageData.startsWith('data:image')) {
            prescriptionBase64 = prescriptionImageData.split(',')[1] || prescriptionImageData;
          } else {
            prescriptionBase64 = prescriptionImageData;
          }
        }
      }

      let qrBase64 = null;
      if (qrImageData) {
        if (Buffer.isBuffer(qrImageData)) {
          qrBase64 = qrImageData.toString('base64');
        } else if (typeof qrImageData === 'string') {
          if (qrImageData.startsWith('data:image')) {
            qrBase64 = qrImageData.split(',')[1] || qrImageData;
          } else {
            qrBase64 = qrImageData;
          }
        }
      }

      // Enviar mensaje inicial simple para "romper el hielo" y evitar bloqueos
      // Usar un mensaje más natural y menos robótico
      try {
        console.log(`📤 [0/4] Enviando mensaje inicial vía HTTP...`);
        const initialMessage = `Hola! Te envío tu receta médica ahora.`;
        await makeHttpRequest(`${MEDICHAT_URL}/test-send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { phoneNumber: phoneNumber, message: initialMessage }
        });
        console.log('✅ [0/4] Mensaje inicial enviado correctamente vía HTTP');
        
        // Esperar MUCHO más tiempo antes de enviar imágenes (15-25 segundos)
        // Esto hace que parezca más humano y menos automático
        const initialDelay = 15000 + Math.random() * 10000; // 15-25 segundos
        console.log(`⏳ Esperando ${Math.round(initialDelay/1000)}s antes de enviar imágenes (simulando comportamiento humano)...`);
        await new Promise(resolve => setTimeout(resolve, initialDelay));
      } catch (initialError) {
        console.warn('⚠️ [0/4] No se pudo enviar mensaje inicial vía HTTP:', initialError.message);
        // Continuar de todas formas
      }

      // Enviar imagen de receta primero
      if (prescriptionBase64) {
        try {
          const imageSizeMB = Buffer.from(prescriptionBase64, 'base64').length / (1024 * 1024);
          console.log(`📤 [1/3] Enviando imagen de receta detallada vía HTTP (${imageSizeMB.toFixed(2)}MB)...`);
          
          const caption = `📋 Receta Médica\nCódigo: ${prescriptionData.prescription_code || 'N/A'}`;
          const response = await makeHttpRequest(`${MEDICHAT_URL}/send-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              phoneNumber: phoneNumber,
              imageBase64: prescriptionBase64,
              filename: `Receta_${prescriptionData.prescription_code || 'receta'}.png`,
              caption: caption
            }
          });

          if (!response.data?.success) {
            console.error('❌ [1/3] No se pudo enviar imagen de receta detallada:', response.data?.error);
            // Enviar como texto si falla la imagen
            try {
              const textMessage = this.formatPrescriptionMessage(prescriptionData);
              await makeHttpRequest(`${MEDICHAT_URL}/test-send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { phoneNumber: phoneNumber, message: textMessage }
              });
            } catch (textError) {
              console.error('❌ Error al enviar receta como texto:', textError.message);
            }
          } else {
            console.log('✅ [1/4] Imagen de receta detallada enviada correctamente');
            // Esperar MUCHO más tiempo entre imágenes (20-30 segundos)
            // Esto simula el comportamiento humano de esperar antes de enviar otra imagen
            const delay = 20000 + Math.random() * 10000; // 20-30 segundos
            console.log(`⏳ Esperando ${Math.round(delay/1000)}s antes de enviar QR (simulando comportamiento humano)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (prescriptionError) {
          console.error('❌ [1/3] Error al enviar imagen de receta:', prescriptionError.message);
          // Enviar como texto si falla la imagen
          try {
            const textMessage = this.formatPrescriptionMessage(prescriptionData);
            await makeHttpRequest(`${MEDICHAT_URL}/test-send-message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: { phoneNumber: phoneNumber, message: textMessage }
            });
          } catch (textError) {
            console.error('❌ Error al enviar receta como texto:', textError.message);
          }
        }
      } else {
        console.warn('⚠️ No hay imagen de receta para enviar, enviando solo como texto');
        // Enviar como texto si no hay imagen
        try {
          const textMessage = this.formatPrescriptionMessage(prescriptionData);
          await makeHttpRequest(`${MEDICHAT_URL}/test-send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { phoneNumber: phoneNumber, message: textMessage }
          });
        } catch (textError) {
          console.error('❌ Error al enviar receta como texto:', textError.message);
        }
      }

      // Enviar QR como segunda imagen
      if (qrBase64) {
        try {
          const imageSizeMB = Buffer.from(qrBase64, 'base64').length / (1024 * 1024);
          console.log(`📤 [2/3] Enviando código QR vía HTTP (${imageSizeMB.toFixed(2)}MB)...`);
          
          const response = await makeHttpRequest(`${MEDICHAT_URL}/send-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              phoneNumber: phoneNumber,
              imageBase64: qrBase64,
              filename: `QR_${prescriptionData.prescription_code || 'receta'}.png`,
              caption: '📱 Código QR de la receta'
            }
          });

          if (!response.data?.success) {
            console.error('❌ [2/3] No se pudo enviar código QR:', response.data?.error);
          } else {
            console.log('✅ [2/3] Código QR enviado correctamente');
            // Esperar 1 segundo antes de enviar el mensaje de texto
            // Delay más largo entre mensajes para evitar bloqueos de WhatsApp
            // Agregar variabilidad aleatoria entre 5-8 segundos
            const delay = 5000 + Math.random() * 3000;
            console.log(`⏳ Esperando ${Math.round(delay/1000)}s antes del próximo mensaje (anti-spam)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (qrError) {
          console.error('❌ [2/3] Error al enviar código QR:', qrError.message);
        }
      } else {
        console.warn('⚠️ No hay código QR para enviar');
      }

      // Mensaje de resumen eliminado - las imágenes son autoexplicativas

      return {
        success: true,
        message: 'Receta enviada correctamente a WhatsApp'
      };
    } catch (error) {
      console.error('❌ Error al enviar receta vía HTTP:', error.message);
      
      if (error.code === 'ECONNREFUSED' || error.message?.includes('timeout')) {
        return {
          success: false,
          error: 'No se pudo conectar con medichat. Verifica que esté corriendo en ' + MEDICHAT_URL
        };
      }
      
      return {
        success: false,
        error: error.message || 'Error al enviar receta'
      };
    }
  }

  /**
   * Enviar receta como mensaje de texto detallado (fallback si falla la imagen)
   * @param {string} phoneNumber - Número de teléfono
   * @param {Object} prescriptionData - Datos de la receta
   * @param {Object} whatsappHandler - Handler de WhatsApp
   */
  async sendPrescriptionAsText(phoneNumber, prescriptionData, whatsappHandler) {
    try {
      const message = this.formatPrescriptionMessage(prescriptionData);
      console.log('📤 Enviando receta como mensaje de texto detallado...');
      await whatsappHandler.sendMessage(phoneNumber, message);
      console.log('✅ Receta enviada como texto correctamente');
    } catch (error) {
      console.error('❌ Error al enviar receta como texto:', error.message);
      throw error;
    }
  }

  /**
   * Formatear mensaje de receta para WhatsApp
   * @param {Object} prescriptionData - Datos de la receta
   * @returns {string} Mensaje formateado
   */
  formatPrescriptionMessage(prescriptionData) {
    const {
      prescription_code,
      patient_name,
      doctor_name,
      doctor_license,
      prescription_date,
      items = [],
      notes
    } = prescriptionData;

    let message = `📋 *RECETA MÉDICA*\n\n`;
    
    // Código de receta
    if (prescription_code) {
      message += `🔖 *Código:* ${prescription_code}\n`;
    }
    
    // Fecha
    if (prescription_date) {
      const date = new Date(prescription_date);
      message += `📅 *Fecha:* ${date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}\n`;
    }
    
    message += `\n`;
    
    // Información del paciente
    message += `👤 *PACIENTE*\n`;
    if (patient_name) {
      message += `Nombre: ${patient_name}\n`;
    }
    message += `\n`;
    
    // Información del médico
    message += `👨‍⚕️ *MÉDICO*\n`;
    if (doctor_name) {
      message += `Nombre: ${doctor_name}\n`;
    }
    if (doctor_license) {
      message += `Colegiatura: ${doctor_license}\n`;
    }
    message += `\n`;
    
    // Medicamentos
    if (items && items.length > 0) {
      message += `💊 *MEDICAMENTOS*\n\n`;
      items.forEach((item, index) => {
        message += `${index + 1}. *${item.product_name || 'Medicamento'}*\n`;
        
        if (item.active_ingredient) {
          message += `   Principio Activo: ${item.active_ingredient}\n`;
        }
        
        if (item.concentration) {
          message += `   Concentración: ${item.concentration}\n`;
        }
        
        message += `   Cantidad Requerida: ${item.quantity_required || 0} unidades\n`;
        
        if (item.quantity_dispensed !== undefined) {
          message += `   Despachado: ${item.quantity_dispensed || 0} unidades\n`;
        }
        
        if (item.instructions) {
          message += `   Instrucciones: ${item.instructions}\n`;
        }
        
        message += `\n`;
      });
    }
    
    // Notas adicionales
    if (notes) {
      message += `📝 *NOTAS*\n${notes}\n\n`;
    }
    
    // Código QR mencionado
    if (prescription_code) {
      message += `\n📱 *Código QR:* ${prescription_code}`;
    }
    
    return message;
  }
}

module.exports = new WhatsAppService();

