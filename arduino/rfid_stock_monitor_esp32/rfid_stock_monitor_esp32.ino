/*
 * Sistema de Monitoreo de Stock con RFID - ESP32
 * Lector RFID RC522 - Detecta cuando se retiran productos
 * Envía datos por Serial al backend Node.js
 * 
 * Compatible con sistema médico de gestión de stock
 * 
 * CONFIGURACIÓN ESP32:
 * - Pines SPI: MOSI=23, MISO=19, SCK=18 (fijos)
 * - SS (SDA) = GPIO 2
 * - RST = GPIO 15
 */

#include <SPI.h>
#include <MFRC522.h>

// ==================== CONFIGURACIÓN DE PINES ESP32 ====================
#define SS_PIN          2           // GPIO 2 - Selección de esclavo (SDA) del RC522
#define RST_PIN         15          // GPIO 15 - Reset del RC522

// Pines SPI hardware del ESP32 (VSPI) - Fijos en hardware
// MOSI = GPIO 23 (D23)
// MISO = GPIO 19 (D19)
// SCK  = GPIO 18 (D18)

MFRC522 mfrc522(SS_PIN, RST_PIN);

String lastUID = "";
unsigned long lastReadTime = 0;
const unsigned long DEBOUNCE_TIME = 2000; // 2 segundos de debounce

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n========================================");
  Serial.println("Sistema RFID ESP32 - Iniciando...");
  Serial.println("========================================\n");
  
  Serial.println("Configuración de pines:");
  Serial.print("  SS_PIN (SDA): GPIO ");
  Serial.println(SS_PIN);
  Serial.print("  RST_PIN: GPIO ");
  Serial.println(RST_PIN);
  Serial.println("  SPI Pines: MOSI=23, MISO=19, SCK=18\n");
  
  // Inicializar SPI
  Serial.println("Inicializando SPI...");
  Serial.print("  Configurando pines: SCK=18, MISO=19, MOSI=23, SS=");
  Serial.println(SS_PIN);
  
  // Configurar pin SS como salida y ponerlo en HIGH antes de inicializar SPI
  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  delay(10);
  
  // Inicializar SPI con los pines correctos
  SPI.begin(18, 19, 23, SS_PIN);  // SCK, MISO, MOSI, SS
  delay(100);
  
  Serial.println("✓ SPI inicializado\n");
  
  // Inicializar MFRC522 con múltiples intentos
  Serial.println("Inicializando MFRC522...");
  bool initSuccess = false;
  
  for (int attempt = 0; attempt < 5; attempt++) {
    Serial.print("  Intento ");
    Serial.print(attempt + 1);
    Serial.print("/5... ");
    
    mfrc522.PCD_Init();
    delay(200);
    
    // Verificar si se puede leer la versión
    byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    
    if (version != 0x00 && version != 0xFF) {
      Serial.println("✓ Éxito");
      initSuccess = true;
      break;
    } else {
      Serial.println("✗ Falló");
      delay(500);
    }
  }
  
  if (!initSuccess) {
    Serial.println("\n❌ ERROR: No se pudo inicializar RC522 después de 5 intentos");
    Serial.println("\nVerifica:");
    Serial.println("  1. Todas las conexiones están firmes");
    Serial.println("  2. El RC522 recibe 3.3V (NO 5V)");
    Serial.println("  3. GND está conectado correctamente");
    Serial.println("  4. Los pines SPI están correctos");
    Serial.println("  5. El módulo RC522 no está dañado");
    Serial.println("\nReiniciando en 5 segundos...\n");
    delay(5000);
    ESP.restart();
    return;
  }
  
  delay(200);
  
  // Aumentar ganancia de la antena para mejor detección (máxima sensibilidad)
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
  
  // Activar la antena
  mfrc522.PCD_AntennaOn();
  
  // Configurar para máxima sensibilidad
  // Aumentar el tiempo de búsqueda de tarjetas
  mfrc522.PCD_WriteRegister(mfrc522.RFCfgReg, 0x70);  // Ganancia máxima (48dB)
  
  // Configurar para detección continua
  mfrc522.PCD_WriteRegister(mfrc522.TxSelReg, 0x83);  // Fuerza 100% ASK
  mfrc522.PCD_WriteRegister(mfrc522.RxSelReg, 0x80);  // Sin filtro
  
  Serial.println("✓ MFRC522 inicializado");
  Serial.println("✓ Antena activada con ganancia máxima\n");
  
  // Verificar conexión leyendo versión
  Serial.println("Verificando conexión con RC522...");
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  Serial.print("Versión del chip: 0x");
  if (version < 0x10) Serial.print("0");
  Serial.println(version, HEX);
  
  // Diagnóstico adicional
  Serial.println("\n📊 Diagnóstico de registros:");
  byte commandReg = mfrc522.PCD_ReadRegister(mfrc522.CommandReg);
  Serial.print("  CommandReg: 0x");
  if (commandReg < 0x10) Serial.print("0");
  Serial.println(commandReg, HEX);
  
  byte comIrqReg = mfrc522.PCD_ReadRegister(mfrc522.ComIrqReg);
  Serial.print("  ComIrqReg: 0x");
  if (comIrqReg < 0x10) Serial.print("0");
  Serial.println(comIrqReg, HEX);
  
  byte divIrqReg = mfrc522.PCD_ReadRegister(mfrc522.DivIrqReg);
  Serial.print("  DivIrqReg: 0x");
  if (divIrqReg < 0x10) Serial.print("0");
  Serial.println(divIrqReg, HEX);
  Serial.println();
  
  // Versiones válidas conocidas: 0x91, 0x92, 0x88, 0x90, 0xB2
  if (version == 0x00 || version == 0xFF) {
    Serial.println("{\"error\":\"RC522 no detectado - Versión inválida\"}");
    Serial.println("\nVerifica las conexiones:");
    Serial.println("  RC522 SDA  → ESP32 GPIO 2");
    Serial.println("  RC522 SCK  → ESP32 GPIO 18");
    Serial.println("  RC522 MOSI → ESP32 GPIO 23");
    Serial.println("  RC522 MISO → ESP32 GPIO 19");
    Serial.println("  RC522 RST  → ESP32 GPIO 15");
    Serial.println("  RC522 GND  → ESP32 GND");
    Serial.println("  RC522 3.3V → ESP32 3V3 (NO 5V)");
  } else {
    // Versión detectada correctamente - el módulo está funcionando
    Serial.print("✓ Versión detectada: 0x");
    if (version < 0x10) Serial.print("0");
    Serial.println(version, HEX);
    Serial.println("  (Versión válida - módulo funcionando)");
    
    // Intentar autotest, pero no es crítico si falla
    Serial.println("\nRealizando autotest...");
    bool autotestPassed = mfrc522.PCD_PerformSelfTest();
    
    if (autotestPassed) {
      Serial.println("{\"status\":\"Sistema RFID iniciado correctamente\"}");
      Serial.println("✓ RC522 detectado y funcionando");
      Serial.println("✓ Autotest completado exitosamente");
    } else {
      // El autotest falló pero la versión se detecta, el módulo puede funcionar igual
      Serial.println("{\"status\":\"Sistema RFID iniciado - Autotest falló pero módulo detectado\"}");
      Serial.println("✓ RC522 detectado (versión válida)");
      Serial.println("⚠ Autotest falló, pero el módulo puede funcionar correctamente");
      Serial.println("  (Algunos módulos RC522 no pasan el autotest pero funcionan bien)");
    }
    
    Serial.println("✓ Esperando tags RFID...\n");
  }
  
  delay(1000);
}

void loop() {
  // Reset del módulo si no hay comunicación (cada 10 segundos)
  static unsigned long lastReset = 0;
  static unsigned long lastHeartbeat = 0;
  static unsigned long lastDiagnostic = 0;
  
  // Heartbeat cada 10 segundos
  if (millis() - lastHeartbeat > 10000) {
    Serial.println("💓 Sistema activo, escuchando tags...");
    lastHeartbeat = millis();
  }
  
  // Diagnóstico cada 30 segundos
  if (millis() - lastDiagnostic > 30000) {
    Serial.println("\n📊 Diagnóstico del módulo:");
    byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    Serial.print("  Versión: 0x");
    if (version < 0x10) Serial.print("0");
    Serial.println(version, HEX);
    
    // Verificar ganancia de antena
    byte gain = mfrc522.PCD_ReadRegister(mfrc522.RFCfgReg);
    Serial.print("  Ganancia antena: 0x");
    if (gain < 0x10) Serial.print("0");
    Serial.println(gain, HEX);
    
    // Verificar que la antena esté activa
    byte txControl = mfrc522.PCD_ReadRegister(mfrc522.TxControlReg);
    Serial.print("  Control TX: 0x");
    if (txControl < 0x10) Serial.print("0");
    Serial.println(txControl, HEX);
    Serial.println();
    
    lastDiagnostic = millis();
  }
  
  if (millis() - lastReset > 30000) {  // Verificar cada 30 segundos (menos frecuente)
    // Verificar que el módulo responda con múltiples intentos
    bool needsReset = true;
    for (int i = 0; i < 3; i++) {  // 3 intentos antes de reinicializar
      byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
      if (version != 0x00 && version != 0xFF) {
        needsReset = false;
        break;  // Versión válida, no necesita reinicio
      }
      delay(50);  // Pequeño delay entre intentos
    }
    
    if (needsReset) {
      Serial.println("⚠ Reinicializando RC522 (módulo no responde)...");
      mfrc522.PCD_Init();
      delay(100);
      mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
      mfrc522.PCD_AntennaOn();
      delay(200);
      
      // Verificar que la reinicialización funcionó
      byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
      if (version != 0x00 && version != 0xFF) {
        Serial.print("✓ RC522 reinicializado correctamente (versión: 0x");
        if (version < 0x10) Serial.print("0");
        Serial.print(version, HEX);
        Serial.println(")");
      } else {
        Serial.println("❌ Error: RC522 no responde después de reinicialización");
      }
    }
    lastReset = millis();
  }
  
  // MÉTODO 1: PICC_IsNewCardPresent (método estándar) - más sensible
  // Sin delay para máxima velocidad de detección
  bool cardPresent = mfrc522.PICC_IsNewCardPresent();
  
  if (cardPresent) {
    Serial.println("📡 [DEBUG] Tarjeta detectada!");
    
    // Intentar leer inmediatamente (sin delays innecesarios)
    if (mfrc522.PICC_ReadCardSerial()) {
      // Obtener el UID
      String uid = "";
      for (byte i = 0; i < mfrc522.uid.size; i++) {
        if (mfrc522.uid.uidByte[i] < 0x10) {
          uid += "0";
        }
        uid += String(mfrc522.uid.uidByte[i], HEX);
      }
      uid.toUpperCase();
      
      // Aplicar debounce
      unsigned long currentTime = millis();
      if (uid != lastUID || (currentTime - lastReadTime) > DEBOUNCE_TIME) {
        lastUID = uid;
        lastReadTime = currentTime;
        
        // Enviar JSON por Serial - usar "entry" para compatibilidad con entrada de stock
        // IMPORTANTE: Enviar todo el JSON en una sola línea para evitar fragmentación
        String jsonMessage = "{\"action\":\"entry\",\"uid\":\"" + uid + "\"}";
        Serial.println(jsonMessage);  // Serial.println agrega \r\n automáticamente
        
        // Mensaje de confirmación (opcional, para debugging)
        Serial.print("✅ Tag detectado: ");
        Serial.println(uid);
        
        // IMPORTANTE: Detener comunicación con el tag y reinicializar para siguiente lectura
        mfrc522.PICC_HaltA();
        mfrc522.PCD_StopCrypto1();
        
        // Pequeño delay y luego continuar el loop (NO hacer return)
        delay(100);
        // Continuar el loop para detectar más tags
      } else {
        // Mismo tag reciente, solo detener comunicación
        mfrc522.PICC_HaltA();
        delay(50);
      }
      // Continuar el loop, NO hacer return aquí
    }
  }
  
  // MÉTODO 2: PICC_RequestA (método alternativo) - más sensible
  // Solo intentar si el método 1 no detectó nada
  if (!cardPresent) {
    byte bufferATQA[2];
    byte bufferSize = sizeof(bufferATQA);
    MFRC522::StatusCode status = mfrc522.PICC_RequestA(bufferATQA, &bufferSize);
    
    if (status == MFRC522::STATUS_OK) {
      Serial.println("🔍 [DEBUG] Señal RFID detectada (método 2), leyendo UID...");
      
      if (mfrc522.PICC_ReadCardSerial()) {
        // Obtener el UID
        String uid = "";
        for (byte i = 0; i < mfrc522.uid.size; i++) {
          if (mfrc522.uid.uidByte[i] < 0x10) {
            uid += "0";
          }
          uid += String(mfrc522.uid.uidByte[i], HEX);
        }
        uid.toUpperCase();
        
        // Aplicar debounce
        unsigned long currentTime = millis();
        if (uid != lastUID || (currentTime - lastReadTime) > DEBOUNCE_TIME) {
          lastUID = uid;
          lastReadTime = currentTime;
          
          // Enviar JSON por Serial - usar "entry" para compatibilidad con entrada de stock
          // IMPORTANTE: Enviar todo el JSON en una sola línea para evitar fragmentación
          String jsonMessage = "{\"action\":\"entry\",\"uid\":\"" + uid + "\"}";
          Serial.println(jsonMessage);  // Serial.println agrega \r\n automáticamente
          
          // Mensaje de confirmación (opcional, para debugging)
          Serial.print("✅ Tag detectado: ");
          Serial.println(uid);
          
          // IMPORTANTE: Detener comunicación con el tag y reinicializar para siguiente lectura
          mfrc522.PICC_HaltA();
          mfrc522.PCD_StopCrypto1();
          
          // Pequeño delay y luego continuar el loop (NO hacer return)
          delay(100);
          // Continuar el loop para detectar más tags
        } else {
          // Mismo tag, solo detener comunicación
          mfrc522.PICC_HaltA();
          delay(50);
        }
      } else {
        // Error al leer UID, detener y continuar
        mfrc522.PICC_HaltA();
        delay(50);
      }
    } else {
      // No mostrar debug constantemente, solo cada 10 segundos
      static unsigned long lastDebug = 0;
      if (millis() - lastDebug > 10000) {
        Serial.println("🔍 [DEBUG] Método 2: Esperando señal RFID...");
        lastDebug = millis();
      }
    }
  }
  
  // MÉTODO 3: Wake-up A (método adicional) - Solo si los anteriores fallaron
  if (!cardPresent) {
    byte bufferATQA2[2];
    byte bufferSize2 = sizeof(bufferATQA2);
    MFRC522::StatusCode status2 = mfrc522.PICC_WakeupA(bufferATQA2, &bufferSize2);
    
    if (status2 == MFRC522::STATUS_OK) {
      Serial.println("🔔 [DEBUG] Tag despertado (método 3), leyendo UID...");
      
      if (mfrc522.PICC_ReadCardSerial()) {
        String uid = "";
        for (byte i = 0; i < mfrc522.uid.size; i++) {
          if (mfrc522.uid.uidByte[i] < 0x10) {
            uid += "0";
          }
          uid += String(mfrc522.uid.uidByte[i], HEX);
        }
        uid.toUpperCase();
        
        unsigned long currentTime = millis();
        if (uid != lastUID || (currentTime - lastReadTime) > DEBOUNCE_TIME) {
          lastUID = uid;
          lastReadTime = currentTime;
          
          // Enviar JSON por Serial - usar "entry" como acción por defecto
          // IMPORTANTE: Enviar todo el JSON en una sola línea para evitar fragmentación
          String jsonMessage = "{\"action\":\"entry\",\"uid\":\"" + uid + "\"}";
          Serial.println(jsonMessage);  // Serial.println agrega \r\n automáticamente
          
          // Mensaje de confirmación (opcional, para debugging)
          Serial.print("✅ Tag detectado: ");
          Serial.println(uid);
          
          // IMPORTANTE: Detener comunicación con el tag y reinicializar para siguiente lectura
          mfrc522.PICC_HaltA();
          mfrc522.PCD_StopCrypto1();
          
          // Pequeño delay y luego continuar el loop (NO hacer return)
          delay(100);
          // Continuar el loop para detectar más tags
        } else {
          // Mismo tag reciente, solo detener comunicación
          mfrc522.PICC_HaltA();
          delay(50);
        }
      } else {
        // Error al leer UID, detener y continuar
        mfrc522.PICC_HaltA();
        delay(50);
      }
    }
  }
  
  // IMPORTANTE: Verificar el módulo periódicamente para asegurar detección continua
  // Esto previene que el módulo quede en un estado donde no detecta más tags
  // Solo verificar cada 30 segundos para no interferir con la detección
  static unsigned long lastReinit = 0;
  if (millis() - lastReinit > 30000) {  // Cada 30 segundos (menos frecuente)
    // Verificar que el módulo responda
    byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    if (version == 0x00 || version == 0xFF) {
      // Módulo no responde, reinicializar
      Serial.println("⚠️ [DEBUG] Módulo RFID no responde, reinicializando...");
      mfrc522.PCD_Init();
      delay(50);
      mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
      mfrc522.PCD_AntennaOn();
      Serial.println("✓ [DEBUG] Módulo RFID reinicializado");
    }
    lastReinit = millis();
  }
  
  // Delay mínimo solo si no se detectó nada
  if (!cardPresent) {
    delay(5);  // Delay muy corto para máxima velocidad de escaneo
  }
}
