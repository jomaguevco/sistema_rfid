# Guía de Diagnóstico RC522 - Cómo saber si el módulo está dañado

## 🔍 Método 1: Usar el Script de Diagnóstico

1. **Sube el archivo `rfid_diagnostico.ino` a tu ESP32**
2. **Abre el Monitor Serial a 115200 baudios**
3. **Observa los resultados:**

### ✅ Si el módulo está BIEN:
- Versión leída: `0x91`, `0x92`, `0x88`, `0x90`, o `0xB2`
- Mensaje: "El módulo está COMUNICÁNDOSE correctamente"
- Puede detectar tags RFID

### ❌ Si el módulo está DAÑADO:
- Versión leída: `0x00` o `0xFF`
- Mensaje de error crítico
- No puede comunicarse con el ESP32

---

## 🔧 Método 2: Verificación Física con Multímetro

### Paso 1: Verificar Alimentación
1. Conecta el multímetro en modo voltímetro DC
2. Mide entre **3.3V** y **GND** del módulo RC522
3. **Debe leer: 3.3V ± 0.1V**
   - ❌ Si lee 0V: Problema de alimentación
   - ❌ Si lee 5V: **¡PELIGRO!** Puede haber dañado el módulo
   - ✅ Si lee 3.3V: Alimentación correcta

### Paso 2: Verificar Continuidad de Pines
Con el multímetro en modo continuidad (buzzer):

**Verifica cada conexión:**
- RC522 SDA → ESP32 GPIO 2: Debe hacer "beep"
- RC522 RST → ESP32 GPIO 15: Debe hacer "beep"
- RC522 MOSI → ESP32 GPIO 23: Debe hacer "beep"
- RC522 MISO → ESP32 GPIO 19: Debe hacer "beep"
- RC522 SCK → ESP32 GPIO 18: Debe hacer "beep"
- RC522 GND → ESP32 GND: Debe hacer "beep"

❌ Si alguna conexión NO hace beep: **Conexión rota o suelta**

### Paso 3: Verificar Cortocircuitos
Con el multímetro en modo continuidad:

**NO debe haber continuidad entre:**
- 3.3V y GND (si hay continuidad = cortocircuito = módulo dañado)
- Pines de datos entre sí (excepto si están conectados intencionalmente)

---

## ⚠️ Señales de que el módulo está DAÑADO

### Señales Físicas:
1. **Olor a quemado** - Componente quemado
2. **Componente hinchado** - Capacitor dañado
3. **Manchas oscuras** - Cortocircuito o sobrecalentamiento
4. **LED no enciende** (si tiene LED de alimentación)

### Señales de Software:
1. **Versión siempre 0x00 o 0xFF** - No hay comunicación
2. **Se calienta mucho** - Cortocircuito interno
3. **Funcionaba antes pero ahora no** - Daño progresivo

---

## 🔥 Causas Comunes de Daño

### 1. Alimentación Incorrecta (MÁS COMÚN)
- ❌ Conectar a 5V en vez de 3.3V
- ❌ Invertir polaridad (GND y VCC cambiados)
- **Resultado:** Módulo quemado instantáneamente

### 2. Cortocircuitos
- Pines tocándose entre sí
- Cables pelados haciendo contacto
- Soldaduras mal hechas

### 3. Sobrecorriente
- Múltiples módulos en el mismo bus SPI sin configuración adecuada
- Cables muy largos sin protección

### 4. Descarga Electroestática (ESD)
- Tocar el módulo sin descargarse primero
- Ambiente muy seco

---

## ✅ Cómo Prevenir Daños

1. **SIEMPRE usar 3.3V** (nunca 5V)
2. **Verificar conexiones ANTES de encender**
3. **Usar cables de buena calidad** y longitud adecuada
4. **Proteger contra ESD** (tocarse a tierra antes de manipular)
5. **No conectar/desconectar con alimentación encendida**

---

## 🧪 Prueba Rápida sin Código

1. **Conecta solo alimentación** (3.3V y GND)
2. **Toca el módulo** - No debe calentarse
3. **Mide voltaje en 3.3V** - Debe ser estable
4. **Si se calienta o el voltaje baja** = Módulo dañado

---

## 📋 Checklist de Diagnóstico

- [ ] Script de diagnóstico muestra versión válida (0x91, 0x92, etc.)
- [ ] Alimentación mide 3.3V correctamente
- [ ] Todas las conexiones tienen continuidad
- [ ] No hay cortocircuitos entre pines
- [ ] El módulo no se calienta
- [ ] No hay olor a quemado
- [ ] No hay componentes hinchados
- [ ] Puede detectar tags RFID

**Si TODOS los puntos están marcados:** Módulo funciona correctamente
**Si alguno falla:** Revisar conexiones o considerar módulo dañado

---

## 🔄 Qué Hacer si el Módulo está Dañado

1. **Desconecta inmediatamente** para evitar más daños
2. **Verifica que no haya dañado la ESP32** (prueba con otro módulo)
3. **Reemplaza el módulo RC522**
4. **Verifica que la nueva conexión sea correcta** antes de encender
5. **Usa el script de diagnóstico** con el nuevo módulo

---

## 💡 Consejos Adicionales

- Los módulos RC522 son relativamente baratos (~$2-5)
- Es mejor reemplazar un módulo sospechoso que arriesgarse
- Guarda módulos de repuesto para pruebas
- Documenta tus conexiones para evitar errores futuros

