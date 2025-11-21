# 🔧 Solución para Problema de Detección RFID

## Cambios Realizados

### 1. Backend (`serialHandler_medical.js`)
- ✅ Ahora acepta cualquier acción (`entry`, `remove`, o sin acción)
- ✅ Siempre emite el evento `rfidDetected` que el frontend escucha
- ✅ Mejor compatibilidad con diferentes tipos de acciones

### 2. Arduino (`rfid_stock_monitor_esp32.ino`)
- ✅ Mejorada la detección con múltiples intentos en cada método
- ✅ Cambiado a enviar `action: "entry"` por defecto (compatible con entrada de stock)
- ✅ Reducido el delay a 10ms para mejor respuesta
- ✅ Agregado método adicional de detección (Wake-up A)

## Pasos para Aplicar la Solución

### Paso 1: Cargar el nuevo código al ESP32

1. Abre Arduino IDE
2. Abre el archivo: `arduino/rfid_stock_monitor_esp32/rfid_stock_monitor_esp32.ino`
3. Verifica la configuración:
   - Placa: ESP32 Dev Module
   - Puerto: COM3 (o el que corresponda)
   - Velocidad: 115200 baud
4. Sube el código al ESP32 (botón "Subir" o Ctrl+U)
5. Espera a que termine la carga
6. Abre el Serial Monitor (Herramientas > Monitor Serie)
   - Velocidad: 115200 baud
   - Deberías ver: "✓ Sistema RFID iniciado correctamente"

### Paso 2: Reiniciar el servidor backend

1. Detén el servidor actual:
   ```bash
   # Opción 1: Usar el script
   .\detener_servidor.bat
   
   # Opción 2: Manualmente
   # Presiona Ctrl+C en la ventana del backend
   ```

2. Inicia el servidor nuevamente:
   ```bash
   .\iniciar_sistema.bat
   ```

   O solo el backend:
   ```bash
   cd backend
   npm run start:medical
   ```

### Paso 3: Verificar la conexión

1. En la consola del backend deberías ver:
   ```
   ✓ Puerto serial abierto: COM3 a 115200 baud
   ✓ Estado del puerto: ABIERTO
   ```

2. En el Serial Monitor del Arduino deberías ver:
   ```
   💓 Sistema activo, escuchando tags...
   ```

### Paso 4: Probar la detección

1. Abre el frontend: http://localhost:5173
2. Ve a "Entrada de Stock"
3. Selecciona un producto
4. Haz clic en "Iniciar Escaneo" (o el botón correspondiente)
5. Acerca una tarjeta RFID al lector

**Lo que deberías ver:**

**En el Serial Monitor del Arduino:**
```
📡 Tarjeta detectada (método 1)
✅ Tag detectado: [UID de la tarjeta]
```

**En la consola del backend:**
```
📨 MENSAJE RECIBIDO DE ARDUINO: {"action":"entry","uid":"[UID]"}
✓ JSON parseado correctamente: { action: 'entry', uid: '[UID]' }
📡 RFID detectado - UID: [UID], Acción: entry
📡 Emitiendo evento Socket.IO 'rfidDetected': ...
✓ Evento emitido a todos los clientes conectados
```

**En el frontend:**
- El modal debería aparecer con el RFID detectado
- O deberías ver el RFID en el campo correspondiente

## Solución de Problemas

### Si el Arduino no detecta tarjetas:

1. **Verifica las conexiones:**
   - RC522 SDA → ESP32 GPIO 2
   - RC522 SCK → ESP32 GPIO 18
   - RC522 MOSI → ESP32 GPIO 23
   - RC522 MISO → ESP32 GPIO 19
   - RC522 RST → ESP32 GPIO 15
   - RC522 GND → ESP32 GND
   - RC522 3.3V → ESP32 3V3 (NO 5V)

2. **Verifica el Serial Monitor:**
   - Deberías ver mensajes cada 10 segundos: "💓 Sistema activo..."
   - Si ves errores, revisa las conexiones

3. **Prueba acercando la tarjeta más cerca:**
   - Algunas tarjetas requieren estar muy cerca (1-2 cm)
   - Prueba diferentes ángulos

4. **Verifica que el módulo RC522 esté funcionando:**
   - En el Serial Monitor deberías ver: "Versión: 0x92" (o similar)
   - Si ves 0x00 o 0xFF, hay un problema de conexión

### Si el backend no recibe datos:

1. **Verifica que el puerto esté abierto:**
   ```bash
   cd backend
   node test_serial.js
   ```
   Deberías ver datos del Arduino

2. **Verifica que no haya otro programa usando COM3:**
   - Cierra Arduino IDE Serial Monitor
   - Cierra cualquier otro programa que use el puerto

3. **Verifica la velocidad (baud rate):**
   - Debe ser 115200 tanto en el Arduino como en el backend

### Si el frontend no recibe el evento:

1. **Verifica la conexión Socket.IO:**
   - Abre la consola del navegador (F12)
   - Deberías ver: "✓ Conectado al servidor Socket.IO"

2. **Verifica los logs del backend:**
   - Deberías ver: "✓ Evento emitido a todos los clientes conectados"
   - Deberías ver: "Clientes conectados: 1" (o más)

3. **Recarga la página:**
   - A veces la conexión Socket.IO se pierde

## Comandos Útiles

### Ver puertos disponibles:
```bash
cd backend
node test_serial.js
```

### Reiniciar solo el backend:
```bash
cd backend
npm run start:medical
```

### Ver logs en tiempo real:
- Backend: Consola donde se ejecuta el servidor
- Arduino: Serial Monitor en Arduino IDE (115200 baud)
- Frontend: Consola del navegador (F12)

## Notas Importantes

- El Arduino ahora envía `action: "entry"` por defecto
- El backend acepta cualquier acción y siempre emite `rfidDetected`
- El frontend escucha el evento `rfidDetected` genérico
- La detección mejorada usa múltiples intentos para mayor sensibilidad
- El delay se redujo a 10ms para mejor respuesta

