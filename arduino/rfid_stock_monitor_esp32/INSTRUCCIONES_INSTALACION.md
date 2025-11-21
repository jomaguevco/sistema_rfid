# Instrucciones para Instalar la Librería MFRC522

## Error Actual
```
fatal error: MFRC522.h: No such file or directory
```

## Solución: Instalar la Librería MFRC522

### Opción 1: Usando Arduino IDE Library Manager (Recomendado)

1. Abre Arduino IDE
2. Ve a **Herramientas** → **Administrar bibliotecas...** (o presiona `Ctrl+Shift+I`)
3. En el buscador, escribe: **MFRC522**
4. Busca una de estas opciones:
   - **"MFRC522"** por **GithubCommunity** (recomendada para ESP32)
   - **"MFRC522-esp"** por **baldram** (específica para ESP32)
5. Haz clic en **Instalar**

### Opción 2: Instalación Manual desde GitHub

Si la opción 1 no funciona, puedes instalar manualmente:

1. Descarga la librería desde GitHub:
   - **MFRC522 para ESP32**: https://github.com/GithubCommunity/MFRC522
   - O **MFRC522-esp**: https://github.com/baldram/ESP8266-RFID-MFRC522

2. En Arduino IDE:
   - Ve a **Croquis** → **Incluir biblioteca** → **Añadir biblioteca .ZIP...**
   - Selecciona el archivo ZIP descargado

### Verificación

Después de instalar:
1. Reinicia Arduino IDE
2. Intenta compilar el proyecto nuevamente
3. El error debería desaparecer

## Nota Importante para ESP32

Asegúrate de tener instalado el **ESP32 Board Support Package**:
1. **Archivo** → **Preferencias**
2. En "Gestor de URLs Adicionales de Tarjetas", añade:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Ve a **Herramientas** → **Placa** → **Gestor de tarjetas**
4. Busca "ESP32" e instala "esp32 by Espressif Systems"

