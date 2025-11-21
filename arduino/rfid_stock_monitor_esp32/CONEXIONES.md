# Conexiones del Módulo RFID RC522 al ESP32

## Diagrama de Conexiones

```
┌─────────────────┐         ┌─────────────────┐
│   Módulo RC522  │         │     ESP32       │
├─────────────────┤         ├─────────────────┤
│ SDA (SS)        │────────→│ GPIO 2          │
│ SCK             │────────→│ GPIO 18         │
│ MOSI            │────────→│ GPIO 23         │
│ MISO            │────────→│ GPIO 19         │
│ RST             │────────→│ GPIO 15         │
│ 3.3V            │────────→│ 3V3             │
│ GND             │────────→│ GND             │
└─────────────────┘         └─────────────────┘
```

## Tabla de Conexiones Detallada

| Pin del RC522 | Pin del ESP32 | Descripción | Notas |
|---------------|---------------|-------------|-------|
| **SDA** (SS)  | **GPIO 2**    | Selección de esclavo SPI | Pin de control |
| **SCK**       | **GPIO 18**   | Reloj SPI (Serial Clock) | Pin SPI hardware |
| **MOSI**      | **GPIO 23**   | Master Out Slave In | Pin SPI hardware |
| **MISO**      | **GPIO 19**   | Master In Slave Out | Pin SPI hardware |
| **RST**       | **GPIO 15**   | Reset del módulo | Pin de control |
| **3.3V**      | **3V3**       | Alimentación | ⚠️ **IMPORTANTE: 3.3V, NO 5V** |
| **GND**       | **GND**       | Tierra común | Múltiples GND disponibles |

## ⚠️ ADVERTENCIAS IMPORTANTES

### 1. Voltaje de Alimentación
- **SIEMPRE usa 3.3V, NUNCA 5V**
- El ESP32 y el RC522 trabajan a 3.3V
- Conectar a 5V puede dañar el módulo RC522 o el ESP32

### 2. Pines SPI
- Los pines SPI (18, 19, 23) son **fijos en hardware** del ESP32
- No se pueden cambiar a otros pines
- GPIO 2 es el pin de selección (SS/SDA) y puede cambiarse en el código si es necesario

### 3. Conexión a Tierra (GND)
- Asegúrate de conectar GND correctamente
- Una mala conexión a tierra puede causar lecturas erróneas o reinicializaciones

## Verificación de Conexiones

Si el sistema muestra reinicializaciones frecuentes, verifica:

1. ✅ Todas las conexiones están firmes (sin cables sueltos)
2. ✅ El RC522 está conectado a **3.3V** (NO 5V)
3. ✅ GND está conectado correctamente
4. ✅ Los pines SPI están en el orden correcto:
   - SCK → GPIO 18
   - MISO → GPIO 19
   - MOSI → GPIO 23
5. ✅ SDA (SS) → GPIO 2
6. ✅ RST → GPIO 15

## Diagnóstico en el Código

El código incluye diagnóstico automático que muestra:
- Versión del chip detectada (debe ser 0x91, 0x92, 0x88, 0x90, o 0xB2)
- Estado de la antena
- Control TX

Si ves versión `0x00` o `0xFF`, significa que el módulo no se está comunicando correctamente.

## Imagen de Referencia Visual

```
ESP32 (vista frontal, pines numerados)
┌─────────────────────────────┐
│                             │
│  [GPIO]  [GPIO]  [GPIO]     │
│    2       15     18        │ ← Conexiones principales
│                             │
│  [GPIO]  [GPIO]  [GPIO]     │
│   19      23     3V3        │
│                             │
│  [GND]                      │
│                             │
└─────────────────────────────┘

RC522 (vista frontal)
┌─────────────────────────────┐
│  [SDA]  [SCK]  [MOSI]       │
│  [MISO] [RST]  [3.3V]       │
│  [GND]                      │
└─────────────────────────────┘
```

## Orden Recomendado de Conexión

1. Primero conecta **GND** (tierra común)
2. Luego conecta **3.3V** (alimentación)
3. Conecta los pines SPI: **SCK, MOSI, MISO**
4. Conecta **SDA (SS)** y **RST**
5. Verifica todas las conexiones antes de encender

## Solución de Problemas

### Problema: "RC522 no detectado"
- Verifica que el voltaje sea 3.3V (no 5V)
- Revisa que GND esté conectado
- Verifica que los pines SPI estén correctos

### Problema: Reinicializaciones frecuentes
- Revisa que todas las conexiones estén firmes
- Verifica que no haya interferencias
- Asegúrate de que el módulo RC522 no esté dañado

### Problema: No detecta tags
- Verifica que la antena esté conectada (viene integrada en el módulo)
- Asegúrate de que los tags estén dentro del rango (2-5 cm)
- Revisa que la ganancia de antena esté configurada (ya está en máximo en el código)

