const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const db = require('./database_medical');

// Configuración del puerto serial
// ESP32 usa 115200 baud por defecto, Arduino Uno usa 9600
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';
const BAUD_RATE = parseInt(process.env.BAUD_RATE || '115200'); // Cambiado a 115200 para ESP32

let serialPort = null;
let parser = null;
let pendingRfidUid = null; // Para almacenar RFID mientras se espera selección de área

/**
 * Inicializar comunicación serial con Arduino
 */
function initSerial() {
  try {
    serialPort = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: false
    });

    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    serialPort.open((err) => {
      if (err) {
        console.error('✗ Error al abrir puerto serial:', err.message);
        console.log('💡 Asegúrate de que:');
        console.log('   1. El ESP32/Arduino está conectado por USB');
        console.log('   2. El puerto serial está configurado correctamente');
        console.log('   3. No hay otro programa usando el puerto serial (cierra Arduino IDE)');
        console.log(`   4. El puerto configurado es: ${SERIAL_PORT}`);
        console.log(`   5. La velocidad es: ${BAUD_RATE} baud (ESP32=115200, Arduino=9600)`);
        return;
      }
      console.log(`✓ Puerto serial abierto: ${SERIAL_PORT} a ${BAUD_RATE} baud`);
      console.log(`✓ Estado del puerto: ${serialPort.isOpen ? 'ABIERTO' : 'CERRADO'}`);
      
      // Escuchar datos en bruto para debugging
      serialPort.on('data', (rawData) => {
        console.log('📦 Datos RAW recibidos:', rawData.toString());
      });
    });

    parser.on('data', async (data) => {
      try {
        const message = data.toString().trim();
        console.log('═══════════════════════════════════════');
        console.log('📨 MENSAJE RECIBIDO DE ARDUINO:');
        console.log('   Raw:', JSON.stringify(message));
        console.log('   Trimmed:', message);
        console.log('═══════════════════════════════════════');
        
        // Intentar parsear como JSON
        let jsonData;
        try {
          jsonData = JSON.parse(message);
          console.log('✓ JSON parseado correctamente:', jsonData);
        } catch (parseError) {
          console.log('⚠️  Mensaje no es JSON válido, ignorando...');
          console.log('   Mensaje original:', message);
          return;
        }

        if ((jsonData.action === 'remove' || jsonData.action === 'entry') && jsonData.uid) {
          const rfidUid = jsonData.uid.toUpperCase().trim();
          const action = jsonData.action; // 'remove' o 'entry'
          
          console.log(`📡 RFID detectado - UID: ${rfidUid}, Acción: ${action}`);
          
          // Emitir evento específico según la acción
          if (global.io) {
            const eventData = {
              rfid_uid: rfidUid,
              action: action,
              timestamp: new Date().toISOString()
            };
            
            // Emitir eventos diferentes según la acción
            if (action === 'entry') {
              console.log(`📡 Emitiendo evento Socket.IO 'rfidEntry':`, eventData);
              global.io.emit('rfidEntry', eventData);
            } else {
              console.log(`📡 Emitiendo evento Socket.IO 'rfidExit':`, eventData);
              global.io.emit('rfidExit', eventData);
            }
            
            // También emitir evento genérico para compatibilidad
            global.io.emit('rfidDetected', eventData);
            
            console.log(`   Clientes conectados: ${global.io.sockets.sockets.size}`);
            console.log('✓ Evento emitido a todos los clientes conectados');
          } else {
            console.error('❌ Socket.IO no disponible (global.io es null)');
            console.error('   No se puede emitir evento RFID');
          }
        } else if (jsonData.status) {
          console.log('ℹ️  Estado de Arduino:', jsonData.status);
        } else if (jsonData.error) {
          console.error('❌ Error de Arduino:', jsonData.error);
        } else {
          console.log('⚠️  Mensaje JSON recibido pero no reconocido:', jsonData);
        }
      } catch (error) {
        console.error('✗ Error al procesar mensaje serial:', error.message);
        console.error('Stack:', error.stack);
      }
    });

    serialPort.on('error', (err) => {
      console.error('✗ Error en puerto serial:', err.message);
    });

    serialPort.on('close', () => {
      console.log('⚠️  Puerto serial cerrado');
    });

    // Verificar alertas periódicamente
    setInterval(async () => {
      try {
        await db.checkAndGenerateAlerts();
      } catch (error) {
        console.error('Error al verificar alertas:', error.message);
      }
    }, 60000); // Cada minuto

  } catch (error) {
    console.error('✗ Error al inicializar comunicación serial:', error.message);
  }
}

/**
 * Manejar la detección de retiro de producto (versión médica con lotes)
 */
async function handleProductRemoval(rfidUid, areaId = null) {
  try {
    console.log(`🛒 Detectado retiro de producto con UID: ${rfidUid}`);
    
    // Buscar producto o lote por RFID
    const productData = await db.getProductByRfidUid(rfidUid);
    
    if (!productData) {
      const errorMsg = `Producto o lote no encontrado para el UID RFID: ${rfidUid}`;
      console.error(`✗ ${errorMsg}`);
      
      if (global.io) {
        global.io.emit('error', {
          message: errorMsg,
          uid: rfidUid
        });
      }
      throw new Error(errorMsg);
    }

    let result;
    let productInfo;

    if (productData.is_batch) {
      // Es un lote específico
      if (productData.is_expired) {
        const errorMsg = `⚠️  ALERTA: Intento de retirar producto VENCIDO - ${productData.name} - Lote: ${productData.lot_number}`;
        console.error(`✗ ${errorMsg}`);
        
        if (global.io) {
          global.io.emit('expiredProductWarning', {
            message: errorMsg,
            product: productData,
            uid: rfidUid
          });
        }
        throw new Error('No se puede retirar un producto vencido');
      }

      result = await db.decrementBatchStock(rfidUid, areaId);
      productInfo = {
        id: productData.id,
        name: productData.name,
        lot_number: productData.lot_number,
        expiry_date: productData.expiry_date,
        quantity: result.quantity,
        is_expired: productData.is_expired,
        days_to_expiry: productData.days_to_expiry
      };

      // Advertir si hay lotes más antiguos (FIFO)
      if (result.fifo_warning) {
        console.warn(`⚠️  ${result.fifo_warning}`);
        if (global.io) {
          global.io.emit('fifoWarning', {
            message: result.fifo_warning,
            product: productInfo
          });
        }
      }
    } else {
      // Es un producto sin lote (compatibilidad con sistema antiguo)
      result = await db.decrementStock(rfidUid, areaId);
      productInfo = {
        id: result.id,
        name: result.name,
        quantity: result.total_stock || result.stock
      };
    }

    console.log(`✓ Stock actualizado: ${productInfo.name}${productInfo.lot_number ? ` - Lote: ${productInfo.lot_number}` : ''} - Cantidad: ${productInfo.quantity}`);

    // Verificar y generar alertas después del retiro
    await db.checkAndGenerateAlerts();

    // Emitir evento de actualización
    if (global.io) {
      global.io.emit('stockUpdated', {
        product: productInfo,
        action: 'remove',
        area_id: areaId,
        timestamp: new Date()
      });

      // Emitir alertas actualizadas
      const alerts = await db.getActiveAlerts();
      global.io.emit('alertsUpdated', alerts);
    }

    return result;
  } catch (error) {
    console.error('✗ Error al procesar retiro de producto:', error.message);
    
    if (global.io) {
      global.io.emit('error', {
        message: error.message,
        uid: rfidUid
      });
    }
    
    throw error;
  }
}

/**
 * Procesar retiro con área específica (llamado desde API)
 */
async function processRemovalWithArea(rfidUid, areaId) {
  return await handleProductRemoval(rfidUid, areaId);
}

function closeSerial() {
  if (serialPort && serialPort.isOpen) {
    serialPort.close((err) => {
      if (err) {
        console.error('✗ Error al cerrar puerto serial:', err.message);
      } else {
        console.log('✓ Puerto serial cerrado correctamente');
      }
    });
  }
}

function isSerialOpen() {
  return serialPort && serialPort.isOpen;
}

async function getAvailablePorts() {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (error) {
    console.error('✗ Error al obtener puertos disponibles:', error.message);
    return [];
  }
}

module.exports = {
  initSerial,
  closeSerial,
  isSerialOpen,
  getAvailablePorts,
  handleProductRemoval,
  processRemovalWithArea
};

