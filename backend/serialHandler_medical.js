const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const db = require('./database_medical');

// Configuración del puerto serial
// ESP32 usa 115200 baud por defecto, Arduino Uno usa 9600
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM4'; // Cambiado a COM4 por defecto
const BAUD_RATE = parseInt(process.env.BAUD_RATE || '115200'); // Cambiado a 115200 para ESP32

let serialPort = null;
let parser = null;
let pendingRfidUid = null; // Para almacenar RFID mientras se espera selección de área
let messageBuffer = ''; // Buffer compartido para evitar problemas en reconexión
let isInitializing = false; // Flag para evitar múltiples inicializaciones simultáneas

/**
 * Función para procesar mensajes RFID (definida fuera para reutilización)
 */
async function processRfidMessage(jsonData) {
  try {
    // Aceptar cualquier acción (remove, entry, o incluso sin acción)
    if (jsonData.uid) {
      const rfidUid = jsonData.uid.toUpperCase().trim();
      const action = jsonData.action || 'detected'; // Por defecto 'detected' si no se especifica
      
      // Emitir evento específico según la acción
      if (global.io) {
        const eventData = {
          rfid_uid: rfidUid,
          action: action,
          timestamp: new Date().toISOString()
        };
        
        // Emitir eventos diferentes según la acción
        if (action === 'entry') {
          global.io.emit('rfidEntry', eventData);
        } else if (action === 'remove') {
          global.io.emit('rfidExit', eventData);
        }
        
        // SIEMPRE emitir evento genérico para compatibilidad (esto es lo que usa el frontend)
        global.io.emit('rfidDetected', eventData);
        
        const clientCount = global.io.sockets.sockets.size;
        console.log(`   ✓ Evento emitido a ${clientCount} cliente(s) conectado(s)`);
      } else {
        console.error('❌ [ERROR] Socket.IO no disponible');
      }
    } else if (jsonData.status) {
      console.log('ℹ️  Estado de Arduino:', jsonData.status);
    } else if (jsonData.error) {
      console.error('❌ Error de Arduino:', jsonData.error);
    } else {
      console.log('⚠️  Mensaje JSON recibido pero no reconocido:', jsonData);
    }
  } catch (error) {
    console.error('✗ Error al procesar mensaje RFID:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * Detectar automáticamente el puerto del ESP32/Arduino
 */
async function detectSerialPort() {
  try {
    const ports = await SerialPort.list();
    console.log('\n🔍 Buscando puertos seriales disponibles...');
    console.log(`   Total de puertos encontrados: ${ports.length}`);
    
    // Buscar puertos que puedan ser ESP32/Arduino
    const possiblePorts = ports.filter(port => {
      const vendorId = port.vendorId?.toLowerCase() || '';
      const manufacturer = port.manufacturer?.toLowerCase() || '';
      const path = port.path?.toLowerCase() || '';
      
      // ESP32 comúnmente tiene estos identificadores
      const isESP32 = 
        manufacturer.includes('silicon labs') ||
        manufacturer.includes('ch340') ||
        manufacturer.includes('cp210') ||
        manufacturer.includes('ftdi') ||
        path.includes('com') && (path.includes('3') || path.includes('4'));
      
      return isESP32 || path.includes('usb') || path.includes('serial');
    });
    
    if (possiblePorts.length > 0) {
      console.log('   Puertos candidatos encontrados:');
      possiblePorts.forEach(port => {
        console.log(`     - ${port.path} (${port.manufacturer || 'Desconocido'})`);
      });
      
      // Si el puerto configurado existe, usarlo (PRIORIDAD AL PUERTO CONFIGURADO)
      const configuredPort = ports.find(p => p.path === SERIAL_PORT);
      if (configuredPort) {
        console.log(`   ✓ Usando puerto configurado en .env: ${SERIAL_PORT}`);
        return SERIAL_PORT;
      }
      
      // Si el puerto configurado no existe, mostrar advertencia y usar el detectado
      if (possiblePorts.length > 0) {
        const selectedPort = possiblePorts[0].path;
        console.log(`   ⚠️  Puerto configurado (${SERIAL_PORT}) no encontrado`);
        console.log(`   ✓ Usando puerto detectado: ${selectedPort}`);
        return selectedPort;
      }
    }
    
    console.log('   ⚠️  No se encontraron puertos candidatos');
    console.log(`   Usando puerto por defecto: ${SERIAL_PORT}`);
    return SERIAL_PORT;
  } catch (error) {
    console.error('✗ Error al detectar puertos:', error.message);
    return SERIAL_PORT;
  }
}

/**
 * Inicializar comunicación serial con Arduino
 */
async function initSerial() {
  // Evitar múltiples inicializaciones simultáneas
  if (isInitializing) {
    console.log('⚠️  Inicialización ya en progreso, ignorando llamada duplicada');
    return;
  }
  
  // Si ya hay un puerto abierto, cerrarlo primero
  if (serialPort && serialPort.isOpen) {
    console.log('⚠️  Cerrando puerto existente antes de reinicializar...');
    try {
      await new Promise((resolve) => {
        serialPort.close((err) => {
          if (err) console.error('Error al cerrar puerto:', err.message);
          resolve();
        });
      });
    } catch (closeErr) {
      console.error('Error al cerrar puerto:', closeErr.message);
    }
  }
  
  isInitializing = true;
  
  try {
    // Detectar puerto automáticamente
    const detectedPort = await detectSerialPort();
    const portToUse = detectedPort || SERIAL_PORT;
    
    console.log(`\n📡 Inicializando comunicación serial...`);
    console.log(`   Puerto detectado: ${detectedPort}`);
    console.log(`   Puerto configurado (.env): ${SERIAL_PORT}`);
    console.log(`   Puerto a usar: ${portToUse}`);
    console.log(`   Velocidad: ${BAUD_RATE} baud`);
    
    // Limpiar buffer al reinicializar
    messageBuffer = '';
    
    serialPort = new SerialPort({
      path: portToUse,
      baudRate: BAUD_RATE,
      autoOpen: false
    });
    
    // IMPORTANTE: NO usar pipe() si queremos escuchar datos RAW directamente
    // El pipe() consume los datos antes de que lleguen al listener on('data')
    // En su lugar, usaremos solo el listener RAW y procesaremos manualmente
    
    // Escuchar datos RAW para capturar TODO lo que llega
    serialPort.on('data', (rawData) => {
      const dataStr = rawData.toString();
      
      // IMPORTANTE: Mostrar TODOS los datos recibidos para debugging
      // Esto ayuda a identificar si el problema es de recepción o procesamiento
      console.log('📦 [RAW DATA RECIBIDO]', rawData.length, 'bytes:', JSON.stringify(dataStr.substring(0, 200)));
      
      // Solo mostrar datos RAW si contienen un JSON potencial (para debugging)
      const hasJsonPotential = dataStr.includes('{"action"') || dataStr.includes('"uid"');
      if (hasJsonPotential) {
        console.log('📦 [RAW] Datos con JSON potencial recibidos:', rawData.length, 'bytes');
      }
      
      // Filtrar mensajes de reinicio del ESP32 que interfieren con la detección
      if (dataStr.includes('ets Jul') || dataStr.includes('POWERON_RESET') || 
          dataStr.includes('waiting for download') || dataStr.includes('rst:')) {
        console.log('⚠️  [ESP32] Reinicio detectado - ignorando');
        return; // No acumular mensajes de reinicio en el buffer
      }
      
      // Acumular en buffer
      messageBuffer += dataStr;
      
      // Limpiar buffer periódicamente de mensajes que no son JSONs (cada 500 caracteres)
      // PERO solo si NO hay un JSON potencial en el buffer
      if (messageBuffer.length > 500) {
        // Verificar si hay un JSON potencial antes de limpiar
        const hasJsonStart = messageBuffer.includes('{"action"');
        
        if (!hasJsonStart) {
          // Buscar el último \r\n para mantener solo los últimos datos
          const lastNewline = messageBuffer.lastIndexOf('\r\n');
          if (lastNewline > 200) {
            // Mantener solo los últimos 200 caracteres antes del último \r\n
            messageBuffer = messageBuffer.substring(Math.max(0, lastNewline - 200));
            // Log silencioso - solo para debugging si es necesario
          }
        }
      }
      
      // Buscar JSONs en el buffer - método mejorado
      const foundJsons = [];
      
      // MÉTODO 1: Buscar JSONs completos con regex
      const jsonPattern = /\{"action":"[^"]+","uid":"[A-F0-9]+"\}/gi;
      let match;
      while ((match = jsonPattern.exec(messageBuffer)) !== null) {
        foundJsons.push({
          json: match[0],
          index: match.index
        });
      }
      
      // MÉTODO 2: Si no encontramos JSONs completos, buscar JSONs fragmentados
      if (foundJsons.length === 0) {
        // Buscar inicio de JSON
        let jsonStart = messageBuffer.indexOf('{"action"');
        
        // Si encontramos el inicio, buscar el final
        while (jsonStart !== -1) {
          // Buscar el cierre de llave después del inicio
          const jsonEnd = messageBuffer.indexOf('}', jsonStart);
          
          if (jsonEnd !== -1) {
            // Extraer el JSON potencial
            const potentialJson = messageBuffer.substring(jsonStart, jsonEnd + 1);
            
            // Verificar que tenga el formato básico correcto
            if (potentialJson.includes('"action"') && potentialJson.includes('"uid"')) {
              try {
                // Intentar parsear para verificar que sea JSON válido
                const testParse = JSON.parse(potentialJson);
                
                // Verificar que tenga los campos requeridos
                if (testParse.action && testParse.uid) {
                  foundJsons.push({
                    json: potentialJson,
                    index: jsonStart
                  });
                  // Log silencioso - JSON reconstruido correctamente
                  break; // Encontramos uno, procesarlo
                }
              } catch (e) {
                // JSON incompleto o inválido, buscar siguiente inicio
                jsonStart = messageBuffer.indexOf('{"action"', jsonStart + 1);
              }
            } else {
              // No tiene el formato correcto, buscar siguiente inicio
              jsonStart = messageBuffer.indexOf('{"action"', jsonStart + 1);
            }
          } else {
            // No encontramos el cierre, el JSON está incompleto - esperar más datos
            break; // Esperar más datos
          }
        }
      }
      
      // Logs del buffer solo cuando se detecta un JSON (ya se mostrará en el procesamiento)
      
      // Procesar JSONs encontrados (de atrás hacia adelante)
      for (let i = foundJsons.length - 1; i >= 0; i--) {
        try {
          const jsonStr = foundJsons[i].json;
          const jsonData = JSON.parse(jsonStr);
          
          console.log('📨 [RFID] Tag detectado - UID:', jsonData.uid, '| Acción:', jsonData.action);
          
          processRfidMessage(jsonData).catch(err => {
            console.error('✗ Error al procesar mensaje RFID:', err.message);
          });
          
          // Eliminar el JSON procesado del buffer (incluyendo \r\n si existe)
          const endIndex = foundJsons[i].index + jsonStr.length;
          let removeLength = jsonStr.length;
          // Eliminar también \r\n si está presente después del JSON
          if (messageBuffer[endIndex] === '\r' && messageBuffer[endIndex + 1] === '\n') {
            removeLength += 2;
          } else if (messageBuffer[endIndex] === '\n') {
            removeLength += 1;
          }
          
          messageBuffer = messageBuffer.substring(0, foundJsons[i].index) + 
                         messageBuffer.substring(foundJsons[i].index + removeLength);
        } catch (parseErr) {
          console.error('⚠️  [ERROR] Error al parsear JSON:', parseErr.message);
        }
      }
      
      // Detectar heartbeat del Arduino para mantener conexión activa
      const trimmedMessage = dataStr.trim();
      if (trimmedMessage && !trimmedMessage.startsWith('{')) {
        // Detectar heartbeat (sistema activo) - MOSTRAR para confirmar recepción
        if (trimmedMessage.includes('💓 Sistema activo') || trimmedMessage.includes('Sistema activo')) {
          console.log('💓 [Arduino Heartbeat] Sistema activo - Conexión OK');
        }
        // Mostrar todos los mensajes importantes del Arduino
        else if (trimmedMessage.startsWith('✅ Tag detectado') || 
                 trimmedMessage.includes('Error al leer UID') ||
                 trimmedMessage.startsWith('❌') ||
                 trimmedMessage.includes('Tag detectado') ||
                 trimmedMessage.includes('Esperando tags')) {
          console.log('📟 [Arduino]', trimmedMessage);
        }
        // Mostrar otros mensajes del Arduino para debugging
        else if (trimmedMessage.length > 0 && trimmedMessage.length < 200) {
          console.log('📟 [Arduino Debug]', trimmedMessage);
        }
      }
      
      // Limpiar buffer si es muy largo
      if (messageBuffer.length > 2000) {
        const lastJsonMatch = messageBuffer.match(/\{"action":"[^"]+","uid":"[A-F0-9]+"\}/i);
        if (lastJsonMatch) {
          try {
            const jsonData = JSON.parse(lastJsonMatch[0]);
            console.log('📨 Procesando último JSON antes de limpiar buffer:', jsonData);
            processRfidMessage(jsonData).catch(err => {
              console.error('✗ Error al procesar último JSON:', err.message);
            });
            messageBuffer = messageBuffer.replace(lastJsonMatch[0], '');
          } catch (e) {
            // Ignorar error
          }
        }
        messageBuffer = messageBuffer.substring(Math.max(0, messageBuffer.length - 1000));
      }
    });

    // NO usar parser con pipe() porque consume los datos antes del listener RAW
    // Procesaremos todo manualmente en el listener RAW
    parser = null;

    // IMPORTANTE: Configurar listeners ANTES de abrir el puerto
    // Asegurar que el listener de datos esté completamente configurado
    console.log('🔧 Configurando listeners ANTES de abrir puerto...');
    console.log('   - Listener de datos configurado:', serialPort.listenerCount('data') > 0 ? '✓' : '✗');
    
    serialPort.open((err) => {
      if (err) {
        console.error('\n❌ Error al abrir puerto serial:', err.message);
        console.log('\n💡 Soluciones posibles:');
        console.log('   1. Verifica que el ESP32/Arduino esté conectado por USB');
        console.log('   2. Cierra Arduino IDE u otros programas que usen el puerto');
        console.log('   3. Desconecta y vuelve a conectar el dispositivo USB');
        console.log('   4. Verifica en el Administrador de Dispositivos que el puerto esté disponible');
        console.log(`   5. Puerto intentado: ${portToUse}`);
        console.log(`   6. Velocidad: ${BAUD_RATE} baud (ESP32=115200, Arduino=9600)`);
        console.log('\n   Para listar puertos disponibles, ejecuta: node backend/test_serial.js\n');
        
        // Intentar listar puertos disponibles
        getAvailablePorts().then(ports => {
          if (ports.length > 0) {
            console.log('   Puertos disponibles:');
            ports.forEach(port => {
              console.log(`     - ${port.path} (${port.manufacturer || 'Desconocido'})`);
            });
          }
        });
        isInitializing = false;
        return;
      }
      console.log(`\n✅ Puerto serial abierto correctamente:`);
      console.log(`   Puerto: ${portToUse}`);
      console.log(`   Velocidad: ${BAUD_RATE} baud`);
      console.log(`   Estado: ${serialPort.isOpen ? 'ABIERTO ✓' : 'CERRADO ✗'}`);
      console.log(`\n📡 Esperando datos del ESP32/Arduino...\n`);
      console.log('🔍 IMPORTANTE: Si NO ves mensajes "📦 [RAW DATA RECIBIDO]" arriba,');
      console.log('   significa que NO se están recibiendo datos del Arduino.');
      console.log('   Verifica que el Arduino esté enviando datos por Serial.\n');
      
      // Verificar que los listeners estén activos INMEDIATAMENTE después de abrir
      console.log('🔍 Verificación INMEDIATA de listeners:');
      const dataListeners = serialPort.listenerCount('data');
      const errorListeners = serialPort.listenerCount('error');
      const closeListeners = serialPort.listenerCount('close');
      
      console.log('   - serialPort.on("data"):', dataListeners > 0 ? `✓ Activo (${dataListeners} listeners)` : '✗ No activo');
      console.log('   - serialPort.on("error"):', errorListeners > 0 ? `✓ Activo (${errorListeners} listeners)` : '✗ No activo');
      console.log('   - serialPort.on("close"):', closeListeners > 0 ? `✓ Activo (${closeListeners} listeners)` : '✗ No activo');
      console.log('   - Puerto abierto:', serialPort.isOpen ? '✓ Sí' : '✗ No');
      console.log('   - Puerto usado:', portToUse);
      console.log('   - Puerto configurado (.env):', SERIAL_PORT);
      console.log('   - Baud rate:', BAUD_RATE);
      
      // ADVERTENCIA si no hay listeners de datos
      if (dataListeners === 0) {
        console.error('   ❌ ERROR CRÍTICO: No hay listeners de datos configurados!');
        console.error('   El puerto está abierto pero NO recibirá datos.');
      }
      
      // Enviar un comando de prueba al Arduino para verificar comunicación bidireccional
      setTimeout(() => {
        if (serialPort.isOpen) {
          console.log('\n📤 Enviando comando de prueba al Arduino...');
          // Algunos Arduinos responden a comandos simples
          try {
            serialPort.write('TEST\n', (err) => {
              if (err) {
                console.error('   ✗ Error al enviar comando de prueba:', err.message);
              } else {
                console.log('   ✓ Comando de prueba enviado');
              }
            });
          } catch (writeErr) {
            console.error('   ✗ Error al escribir:', writeErr.message);
          }
        }
      }, 500);
      
      // Verificar nuevamente después de 3 segundos
      setTimeout(() => {
        console.log('\n🔍 Verificación después de 3 segundos:');
        console.log('   - serialPort.on("data"):', serialPort.listenerCount('data') > 0 ? '✓ Activo (' + serialPort.listenerCount('data') + ' listeners)' : '✗ No activo');
        console.log('   - Puerto abierto:', serialPort.isOpen ? '✓ Sí' : '✗ No');
        console.log('   - Si NO ves mensajes "📦 [RAW DATA RECIBIDO]" arriba:');
        console.log('     → El Arduino puede no estar enviando datos');
        console.log('     → Verifica que el Arduino esté conectado y funcionando');
        console.log('     → Verifica que el puerto sea el correcto (COM3 vs COM4)');
        console.log('     → Verifica que el baud rate sea correcto (115200 para ESP32)');
        console.log('     → Abre el Monitor Serial del Arduino IDE para verificar que esté enviando datos');
      }, 3000);
    });

    serialPort.on('error', (err) => {
      console.error('\n═══════════════════════════════════════');
      console.error('❌ ERROR EN PUERTO SERIAL:');
      console.error('   Mensaje:', err.message);
      console.error('   Código:', err.code);
      console.error('   Stack:', err.stack);
      console.error('═══════════════════════════════════════');
      
      // Si el puerto se desconecta, intentar reconectar después de un tiempo
      if (err.code === 'ENOENT' || err.message.includes('not found')) {
        console.log('   ⚠️  El puerto se desconectó. Intentando reconectar en 5 segundos...');
        setTimeout(() => {
          reconnectSerial();
        }, 5000);
      }
    });

    serialPort.on('close', () => {
      console.log('\n⚠️  Puerto serial cerrado');
      console.log('   Esperando 5 segundos antes de reconectar...');
      console.log('   (Esto permite que el puerto esté disponible nuevamente)');
      
      // Esperar más tiempo antes de reconectar para dar tiempo a que el puerto esté disponible
      setTimeout(() => {
        reconnectSerial();
      }, 5000);
    });

    // Verificar alertas periódicamente
    setInterval(async () => {
      try {
        await db.checkAndGenerateAlerts();
      } catch (error) {
        console.error('Error al verificar alertas:', error.message);
      }
    }, 60000); // Cada minuto

    isInitializing = false;
  } catch (error) {
    console.error('✗ Error al inicializar comunicación serial:', error.message);
    console.error('Stack:', error.stack);
    isInitializing = false;
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

/**
 * Reinicializar puerto serial (útil si se desconecta)
 */
async function reconnectSerial() {
  try {
    console.log('\n🔄 Intentando reconectar puerto serial...');
    
    // Cerrar puerto actual si está abierto
    if (serialPort && serialPort.isOpen) {
      await new Promise((resolve) => {
        serialPort.close((err) => {
          if (err) {
            // Ignorar errores al cerrar (puede que ya esté cerrado)
          }
          resolve();
        });
      });
    }
    
    // Limpiar referencias y buffer
    serialPort = null;
    parser = null;
    messageBuffer = ''; // Limpiar buffer al reconectar
    
    // Esperar más tiempo para que el puerto esté disponible (5 segundos)
    console.log('   Esperando 5 segundos para que el puerto esté disponible...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verificar puertos disponibles antes de intentar reconectar
    const ports = await SerialPort.list();
    console.log(`   Puertos disponibles encontrados: ${ports.length}`);
    
    if (ports.length === 0) {
      console.log('   ⚠️  No hay puertos disponibles. El Arduino puede estar desconectado.');
      console.log('   El sistema seguirá intentando reconectar cada 10 segundos...');
      
      // Intentar nuevamente en 10 segundos
      setTimeout(() => {
        reconnectSerial();
      }, 10000);
      return;
    }
    
    // Mostrar puertos disponibles para debugging
    ports.forEach(port => {
      console.log(`     - ${port.path} (${port.manufacturer || 'Desconocido'})`);
    });
    
    // Reinicializar
    await initSerial();
  } catch (error) {
    console.error('✗ Error al reconectar:', error.message);
    console.log('   Intentando nuevamente en 10 segundos...');
    
    // Intentar nuevamente en 10 segundos
    setTimeout(() => {
      reconnectSerial();
    }, 10000);
  }
}

module.exports = {
  initSerial,
  closeSerial,
  isSerialOpen,
  getAvailablePorts,
  handleProductRemoval,
  processRemovalWithArea,
  reconnectSerial
};

