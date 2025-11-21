const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

async function testSerial() {
  console.log('========================================');
  console.log('🔍 Diagnóstico de Puerto Serial');
  console.log('========================================\n');

  // 1. Listar puertos disponibles
  console.log('1. Puertos seriales disponibles:');
  console.log('----------------------------------------');
  try {
    const ports = await SerialPort.list();
    if (ports.length === 0) {
      console.log('❌ No se encontraron puertos seriales');
    } else {
      ports.forEach((port, index) => {
        console.log(`   ${index + 1}. ${port.path}`);
        console.log(`      - Fabricante: ${port.manufacturer || 'Desconocido'}`);
        console.log(`      - Producto: ${port.pName || 'Desconocido'}`);
        console.log(`      - VID: ${port.vendorId || 'N/A'}`);
        console.log(`      - PID: ${port.productId || 'N/A'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error al listar puertos:', error.message);
  }

  // 2. Intentar conectar al puerto configurado
  const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3';
  const BAUD_RATE = parseInt(process.env.BAUD_RATE || '115200');

  console.log('\n2. Intentando conectar al puerto configurado:');
  console.log('----------------------------------------');
  console.log(`   Puerto: ${SERIAL_PORT}`);
  console.log(`   Velocidad: ${BAUD_RATE} baud`);
  console.log('');

  let serialPort = null;
  let parser = null;

  try {
    serialPort = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
      autoOpen: false
    });

    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    serialPort.open((err) => {
      if (err) {
        console.error(`❌ Error al abrir puerto ${SERIAL_PORT}:`, err.message);
        console.log('\n💡 Posibles soluciones:');
        console.log('   1. Verifica que el ESP32/Arduino esté conectado');
        console.log('   2. Verifica que el puerto sea correcto (ver lista arriba)');
        console.log('   3. Cierra Arduino IDE si está abierto');
        console.log('   4. Cierra cualquier otro programa usando el puerto');
        console.log('   5. Desconecta y vuelve a conectar el dispositivo USB');
        process.exit(1);
      }

      console.log(`✓ Puerto ${SERIAL_PORT} abierto correctamente`);
      console.log(`✓ Velocidad: ${BAUD_RATE} baud`);
      console.log(`✓ Estado: ${serialPort.isOpen ? 'ABIERTO' : 'CERRADO'}`);
      console.log('\n3. Escuchando datos del puerto serial...');
      console.log('----------------------------------------');
      console.log('   Acerca una tarjeta RFID al lector...');
      console.log('   (Presiona Ctrl+C para salir)\n');

      // Escuchar datos en bruto
      serialPort.on('data', (rawData) => {
        const data = rawData.toString();
        console.log(`📦 RAW: ${JSON.stringify(data)}`);
      });

      // Escuchar datos parseados
      parser.on('data', (data) => {
        const message = data.toString().trim();
        console.log(`\n📨 MENSAJE RECIBIDO:`);
        console.log(`   Raw: ${JSON.stringify(message)}`);
        console.log(`   Trimmed: ${message}`);

        // Intentar parsear como JSON
        try {
          const jsonData = JSON.parse(message);
          console.log(`   ✓ JSON válido:`, jsonData);
          
          if (jsonData.action && jsonData.uid) {
            console.log(`   ✓ RFID detectado: ${jsonData.uid} (acción: ${jsonData.action})`);
          }
        } catch (parseError) {
          console.log(`   ⚠️  No es JSON válido`);
        }
        console.log('');
      });

      serialPort.on('error', (err) => {
        console.error(`❌ Error en puerto serial:`, err.message);
      });

      serialPort.on('close', () => {
        console.log('\n⚠️  Puerto serial cerrado');
      });

      // Timeout de prueba (30 segundos)
      setTimeout(() => {
        console.log('\n⏱️  Tiempo de prueba completado (30 segundos)');
        console.log('   Si no recibiste datos, verifica:');
        console.log('   1. Que el ESP32 esté encendido y funcionando');
        console.log('   2. Que el código del Arduino esté cargado');
        console.log('   3. Que la velocidad (baud rate) sea correcta');
        console.log('   4. Que las conexiones del módulo RFID estén correctas');
        if (serialPort && serialPort.isOpen) {
          serialPort.close();
        }
        process.exit(0);
      }, 30000);

    });

  } catch (error) {
    console.error('❌ Error al crear puerto serial:', error.message);
    process.exit(1);
  }

  // Manejar cierre limpio
  process.on('SIGINT', () => {
    console.log('\n\nCerrando conexión...');
    if (serialPort && serialPort.isOpen) {
      serialPort.close(() => {
        console.log('✓ Puerto cerrado');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
}

testSerial();

