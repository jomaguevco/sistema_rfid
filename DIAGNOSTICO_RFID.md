# 🔍 Diagnóstico de Problema RFID

## Problema Reportado

El ESP32 detecta el tag RFID correctamente y envía el JSON:
```json
{"action":"remove","uid":"6B032606"}
```

Pero el sistema web no recibe el evento y el modal sigue abierto.

## Pasos de Diagnóstico

### 1. Verificar Backend (Consola del Servidor)

Cuando acerques el tag RFID, deberías ver en la consola del servidor:

```
📨 Mensaje recibido de Arduino: {"action":"remove","uid":"6B032606"}
✓ JSON parseado correctamente: { action: 'remove', uid: '6B032606' }
📡 RFID detectado - UID: 6B032606
📡 Emitiendo evento Socket.IO 'rfidDetected': { rfid_uid: '6B032606', timestamp: '...' }
   Clientes conectados: 1
✓ Evento emitido a todos los clientes conectados
```

**Si NO ves estos mensajes:**
- El puerto serial no está recibiendo datos
- Verifica que el ESP32 esté conectado
- Verifica que no haya otro programa usando COM3

### 2. Verificar Frontend (Consola del Navegador)

Cuando acerques el tag RFID, deberías ver en la consola del navegador (F12):

```
📡 ===== EVENTO RFID DETECTADO RECIBIDO =====
   Datos recibidos: {rfid_uid: "6B032606", timestamp: "..."}
   Timestamp: ...
🔍 Verificando modo asignación: {active: true, batchId: 1420, ...}
✅ Modo asignación activo, asignando RFID al lote: 1420
   RFID UID: 6B032606
   Llamando a assignDetectedRfid...
🎯 assignDetectedRfid llamado: {batchId: 1420, rfidUid: "6B032606"}
✅ RFID asignado exitosamente
```

**Si NO ves estos mensajes:**
- El evento Socket.IO no está llegando al frontend
- Verifica que Socket.IO esté conectado (deberías ver "✓ Conectado al servidor Socket.IO")
- Verifica que no haya errores de conexión

### 3. Verificar Conexión Socket.IO

En la consola del navegador, ejecuta:
```javascript
window.socket.connected
```

Debería retornar `true`. Si retorna `false`, hay un problema de conexión.

### 4. Verificar Modo de Asignación

En la consola del navegador, ejecuta:
```javascript
window.rfidAssignmentMode
```

Debería mostrar:
```javascript
{
  active: true,
  batchId: 1420,
  timeout: ...
}
```

Si `active` es `false`, el modo no está activo.

## Soluciones

### Si el backend NO recibe mensajes:

1. **Verificar puerto serial:**
   ```bash
   # Ver puertos disponibles
   node backend/test_serial.js
   ```

2. **Verificar que el ESP32 esté enviando:**
   - Abre el Serial Monitor del Arduino IDE
   - Configura a 115200 baud
   - Deberías ver los mensajes JSON

3. **Verificar que no haya conflicto de puerto:**
   - Cierra Arduino IDE si está abierto
   - Cierra cualquier otro programa que use COM3

### Si el backend SÍ recibe pero el frontend NO:

1. **Verificar conexión Socket.IO:**
   - Recarga la página
   - Verifica que veas "✓ Conectado al servidor Socket.IO" en la consola

2. **Verificar que el evento se esté emitiendo:**
   - Revisa los logs del servidor
   - Deberías ver "✓ Evento emitido a todos los clientes conectados"

3. **Probar manualmente:**
   En la consola del navegador:
   ```javascript
   window.socket.emit('test', {message: 'test'});
   ```
   Deberías ver una respuesta en los logs del servidor.

## Comandos Útiles

### Verificar puerto serial manualmente:
```bash
cd backend
node test_serial.js
```

### Reiniciar servidor:
```bash
# Detener servidor actual
Get-Process node | Stop-Process

# Iniciar servidor
cd backend
node server_medical.js
```

## Logs Esperados

### Backend (Consola del Servidor):
```
📨 Mensaje recibido de Arduino: {"action":"remove","uid":"6B032606"}
✓ JSON parseado correctamente: { action: 'remove', uid: '6B032606' }
📡 RFID detectado - UID: 6B032606
📡 Emitiendo evento Socket.IO 'rfidDetected': { rfid_uid: '6B032606', ... }
   Clientes conectados: 1
✓ Evento emitido a todos los clientes conectados
```

### Frontend (Consola del Navegador):
```
📡 ===== EVENTO RFID DETECTADO RECIBIDO =====
   Datos recibidos: {rfid_uid: "6B032606", ...}
✅ Modo asignación activo, asignando RFID al lote: 1420
🎯 assignDetectedRfid llamado: {batchId: 1420, rfidUid: "6B032606"}
✅ RFID asignado exitosamente
```

