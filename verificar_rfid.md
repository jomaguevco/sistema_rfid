# 🔍 Verificación de Conexión RFID

## Problema Identificado

El Arduino está detectando y enviando los datos correctamente:
```
{"action":"entry","uid":"6D492606"}
```

Pero el backend Node.js no los está recibiendo porque **el Serial Monitor del Arduino IDE está bloqueando el puerto COM3**.

## Solución Inmediata

### Paso 1: Cerrar Serial Monitor del Arduino IDE
1. Ve a Arduino IDE
2. Cierra el Serial Monitor (botón X o Herramientas > Monitor Serie)
3. **IMPORTANTE**: El puerto COM3 solo puede ser usado por UN programa a la vez

### Paso 2: Verificar que el Backend esté Corriendo
1. Verifica que el backend esté ejecutándose
2. En la consola del backend deberías ver:
   ```
   ✓ Puerto serial abierto: COM3 a 115200 baud
   ✓ Estado del puerto: ABIERTO
   ```

### Paso 3: Probar la Detección
1. Con el Serial Monitor cerrado
2. Con el backend corriendo
3. Acerca una tarjeta RFID al lector

**Deberías ver en la consola del backend:**
```
📦 Datos RAW recibidos: {"action":"entry","uid":"6D492606"}

═══════════════════════════════════════
📨 MENSAJE RECIBIDO DE ARDUINO:
   Raw: "{\"action\":\"entry\",\"uid\":\"6D492606\"}"
   Trimmed: {"action":"entry","uid":"6D492606"}
═══════════════════════════════════════
✓ JSON parseado correctamente: { action: 'entry', uid: '6D492606' }
📡 RFID detectado - UID: 6D492606, Acción: entry
📡 Emitiendo evento Socket.IO 'rfidDetected': ...
   Clientes conectados: 1
✓ Evento emitido a todos los clientes conectados
```

## Regla Importante

**El puerto serial COM3 solo puede ser usado por UN programa a la vez:**

- ✅ Backend Node.js usando COM3
- ❌ Serial Monitor del Arduino IDE usando COM3
- ❌ Cualquier otro programa usando COM3

**NO puedes tener ambos abiertos al mismo tiempo.**

## Si Necesitas Ver los Logs del Arduino

Si quieres ver los logs del Arduino mientras el backend está corriendo:

1. **Opción 1**: Usa el script de diagnóstico del backend:
   ```bash
   cd backend
   node test_serial.js
   ```
   Este script muestra tanto los datos RAW como los mensajes parseados.

2. **Opción 2**: Revisa los logs del backend, que muestran todo lo que recibe del Arduino.

3. **Opción 3**: Detén el backend temporalmente, abre Serial Monitor, y luego vuelve a iniciar el backend.

## Verificación de Conexión Socket.IO

Para verificar que el frontend está conectado:

1. Abre la consola del navegador (F12)
2. Deberías ver: `✅ Conectado al servidor Socket.IO`
3. Si no ves esto, recarga la página

## Checklist de Verificación

- [ ] Serial Monitor del Arduino IDE está CERRADO
- [ ] Backend está corriendo y muestra "Puerto serial abierto: COM3"
- [ ] Frontend está abierto y muestra "Conectado al servidor Socket.IO"
- [ ] Acercas la tarjeta RFID al lector
- [ ] Ves los logs en la consola del backend
- [ ] El RFID aparece en el frontend

