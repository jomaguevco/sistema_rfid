# 📋 Pasos para Solucionar el Problema RFID

## Paso 1: Cerrar el Serial Monitor del Arduino IDE

1. **NO necesitas cerrar todo el Arduino IDE**, solo el Serial Monitor
2. En Arduino IDE, busca la ventana del **Serial Monitor**
3. Haz clic en el botón **X** para cerrar el Serial Monitor
   - O ve a: **Herramientas > Monitor Serie** para cerrarlo

**IMPORTANTE**: El Serial Monitor es lo que está bloqueando el puerto COM3

## Paso 2: Verificar que el Backend esté Corriendo

1. Busca la ventana de comandos donde está corriendo el backend
2. Deberías ver algo como:
   ```
   ✓ Puerto serial abierto: COM3 a 115200 baud
   ✓ Estado del puerto: ABIERTO
   ```

**Si NO ves esto o ves un error:**
- El backend necesita reiniciarse
- Ve al Paso 3

**Si SÍ ves esto:**
- El backend está listo
- Ve directamente al Paso 4

## Paso 3: Reiniciar el Backend (solo si es necesario)

**Opción A - Si el backend está corriendo pero no muestra el puerto abierto:**
1. En la ventana del backend, presiona **Ctrl+C** para detenerlo
2. Espera 2-3 segundos
3. Ejecuta:
   ```bash
   cd backend
   npm run start:medical
   ```

**Opción B - Si usas el script de inicio:**
1. Ejecuta: `.\detener_servidor.bat`
2. Espera 2-3 segundos
3. Ejecuta: `.\iniciar_sistema.bat`

## Paso 4: Probar la Detección RFID

1. **Abre el frontend** en tu navegador: http://localhost:5173
2. Ve a **"Entrada de Stock"**
3. **Selecciona un producto** (ej: Dimehidrinato)
4. Haz clic en **"Iniciar Escaneo"** (o el botón correspondiente)
5. **Acerca la tarjeta RFID** al lector (a 1-2 cm de distancia)

## Paso 5: Verificar que Funcione

**En la consola del backend deberías ver:**
```
📦 Datos RAW recibidos: {"action":"entry","uid":"6D492606"}
📨 MENSAJE RECIBIDO DE ARDUINO: {"action":"entry","uid":"6D492606"}
✓ JSON parseado correctamente: { action: 'entry', uid: '6D492606' }
📡 RFID detectado - UID: 6D492606, Acción: entry
📡 Emitiendo evento Socket.IO 'rfidDetected': ...
   Clientes conectados: 1
✓ Evento emitido a todos los clientes conectados
```

**En el frontend:**
- Deberías ver el RFID aparecer automáticamente
- O debería abrirse un modal con el RFID detectado

## Resumen Rápido

1. ✅ Cerrar Serial Monitor del Arduino IDE
2. ✅ Verificar backend corriendo (o reiniciarlo si es necesario)
3. ✅ Probar detección RFID en el frontend
4. ✅ Verificar logs en backend y frontend

## ⚠️ Recordatorio Importante

**NUNCA tengas abierto el Serial Monitor del Arduino IDE mientras el backend está corriendo.**

El puerto COM3 solo puede ser usado por UN programa a la vez:
- ✅ Backend Node.js
- ❌ Serial Monitor del Arduino IDE
- ❌ Cualquier otro programa

