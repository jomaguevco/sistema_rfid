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

// Variables para diagnóstico
unsigned long lastDiagnosticTime = 0;
const unsigned long DIAGNOSTIC_INTERVAL = 30000; // Cada 30 segundos
int failedReads = 0;
int successfulReads = 0;

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
  
  // RESET COMPLETO del módulo para asegurar estado limpio
  Serial.println("Realizando reset completo del módulo...");
  mfrc522.PCD_Reset();
  delay(100);
  
  // Reinicializar después del reset
  mfrc522.PCD_Init();
  delay(100);
  
  // Configurar ganancia de la antena para mejor detección (máxima sensibilidad)
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
  
  // Activar la antena con configuración agresiva
  mfrc522.PCD_AntennaOn();
  
  // Asegurar que la antena esté completamente activa
  // Escribir directamente al registro de control TX para máxima potencia
  mfrc522.PCD_WriteRegister(mfrc522.TxControlReg, 0x83); // Máxima potencia TX
  
  // Configurar timeout para mejor detección
  mfrc522.PCD_SetRegisterBitMask(mfrc522.TxASKReg, 0x40);
  
  delay(100);
  
  // Verificar que la antena está realmente activa
  byte antennaState = mfrc522.PCD_ReadRegister(mfrc522.TxControlReg);
  Serial.println("✓ MFRC522 inicializado");
  Serial.print("  Estado de antena: 0x");
  if (antennaState < 0x10) Serial.print("0");
  Serial.println(antennaState, HEX);
  
  // Verificar ganancia de recepción
  byte rxGain = mfrc522.PCD_ReadRegister(mfrc522.RFCfgReg);
  Serial.print("  Ganancia RX: 0x");
  if (rxGain < 0x10) Serial.print("0");
  Serial.println(rxGain, HEX);
  
  // Verificar configuración de la antena
  byte txControl = mfrc522.PCD_ReadRegister(mfrc522.TxControlReg);
  if ((txControl & 0x03) == 0x00) {
    Serial.println("  ⚠️ ADVERTENCIA: Antena podría no estar activa correctamente");
    // Forzar activación
    mfrc522.PCD_WriteRegister(mfrc522.TxControlReg, 0x83);
    Serial.println("  ✓ Antena forzada a activación");
  } else {
    Serial.println("  ✓ Antena activada correctamente");
  }
  
  Serial.println("✓ Antena configurada con ganancia máxima y potencia máxima");
  
  // Prueba de transmisión de antena
  Serial.println("\n📡 Prueba de transmisión de antena...");
  for (int i = 0; i < 3; i++) {
    byte bufferATQA[2];
    byte bufferSize = sizeof(bufferATQA);
    MFRC522::StatusCode testStatus = mfrc522.PICC_RequestA(bufferATQA, &bufferSize);
    Serial.print("  Intento ");
    Serial.print(i + 1);
    Serial.print(": Estado = ");
    Serial.println(testStatus);
    delay(100);
  }
  Serial.println("");
  
  // Verificar conexión leyendo versión
  Serial.println("Verificando conexión con RC522...");
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  Serial.print("Versión del chip: 0x");
  if (version < 0x10) Serial.print("0");
  Serial.println(version, HEX);
  
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
    Serial.print("✓ Versión detectada: 0x");
    if (version < 0x10) Serial.print("0");
    Serial.println(version, HEX);
    Serial.println("  (Versión válida - módulo funcionando)");
      Serial.println("{\"status\":\"Sistema RFID iniciado correctamente\"}");
    Serial.println("✓ Esperando tags RFID...\n");
  }
  
  delay(1000);
}

void loop() {
  // Heartbeat cada 10 segundos
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 10000) {
    Serial.println("💓 Sistema activo, escuchando tags...");
    Serial.print("  Estadísticas: ");
    Serial.print(successfulReads);
    Serial.print(" exitosas, ");
    Serial.print(failedReads);
    Serial.println(" fallidas");
    lastHeartbeat = millis();
  }
  
  // Diagnóstico detallado cada 30 segundos
  if (millis() - lastDiagnosticTime > DIAGNOSTIC_INTERVAL) {
    Serial.println("\n🔍 DIAGNÓSTICO DEL MÓDULO:");
    Serial.println("─────────────────────────────");
    
    // Verificar versión
    byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    Serial.print("  Versión chip: 0x");
    if (version < 0x10) Serial.print("0");
    Serial.println(version, HEX);
    
    // Verificar estado de la antena
    byte txControl = mfrc522.PCD_ReadRegister(mfrc522.TxControlReg);
    Serial.print("  Control TX: 0x");
    if (txControl < 0x10) Serial.print("0");
    Serial.println(txControl, HEX);
    
    // Verificar ganancia
    byte rxGain = mfrc522.PCD_ReadRegister(mfrc522.RFCfgReg);
    Serial.print("  Ganancia RX: 0x");
    if (rxGain < 0x10) Serial.print("0");
    Serial.println(rxGain, HEX);
    
    // Verificar estado de comando
    byte commandReg = mfrc522.PCD_ReadRegister(mfrc522.CommandReg);
    Serial.print("  Comando Reg: 0x");
    if (commandReg < 0x10) Serial.print("0");
    Serial.println(commandReg, HEX);
    
    // Verificar si la antena está activa
    if ((txControl & 0x03) == 0x00) {
      Serial.println("  ⚠️ PROBLEMA: Antena no activa - Reinicializando...");
      mfrc522.PCD_Init();
      delay(50);
      mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
      mfrc522.PCD_AntennaOn();
      Serial.println("  ✓ Antena reinicializada");
    } else {
      Serial.println("  ✓ Antena activa");
    }
    
    Serial.println("─────────────────────────────\n");
    lastDiagnosticTime = millis();
  }
  
  // Reinicializar antena periódicamente (cada 20 segundos) para mantener detección activa
  static unsigned long lastAntennaReset = 0;
  if (millis() - lastAntennaReset > 20000) {
    // Reinicializar suavemente la antena sin perder comunicación
    mfrc522.PCD_AntennaOff();
    delay(10);
    mfrc522.PCD_AntennaOn();
    mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
    lastAntennaReset = millis();
  }
  
  // Verificar módulo periódicamente (cada 60 segundos para no interferir)
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 60000) {
    byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    if (version == 0x00 || version == 0xFF) {
      Serial.println("⚠️ Reinicializando RC522...");
      mfrc522.PCD_Init();
      delay(50);
      mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
      mfrc522.PCD_AntennaOn();
    }
    lastCheck = millis();
  }
  
  // MÉTODO 1: PICC_IsNewCardPresent (más rápido, probar primero)
  if (mfrc522.PICC_IsNewCardPresent()) {
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
      
      // Verificar que el UID no esté vacío
      if (uid.length() > 0) {
        // Aplicar debounce
        unsigned long currentTime = millis();
        if (uid != lastUID || (currentTime - lastReadTime) > DEBOUNCE_TIME) {
          lastUID = uid;
          lastReadTime = currentTime;
          successfulReads++;
          
          // Enviar JSON por Serial
          String jsonMessage = "{\"action\":\"entry\",\"uid\":\"" + uid + "\"}";
          Serial.println(jsonMessage);
          
          // Mensaje de confirmación
          Serial.print("✅ Tag detectado: ");
          Serial.println(uid);
        }
        
        // Detener comunicación con el tag
        mfrc522.PICC_HaltA();
        mfrc522.PCD_StopCrypto1();
        
        delay(100);
      } else {
        failedReads++;
        mfrc522.PICC_HaltA();
      }
    } else {
      failedReads++;
      mfrc522.PICC_HaltA();
    }
  }
  // MÉTODO 2: PICC_RequestA (método alternativo)
  else {
    byte bufferATQA[2];
    byte bufferSize = sizeof(bufferATQA);
    
    // NO llamar HaltA antes - puede interferir con la detección
    MFRC522::StatusCode status = mfrc522.PICC_RequestA(bufferATQA, &bufferSize);
    
    // Delay adaptativo según el estado (definir aquí para tener acceso a status)
    static int consecutiveCollisions = 0;
    static unsigned long lastDelayTime = 0;
    
    // Debug: mostrar estado cada cierto tiempo cuando hay actividad interesante
    static unsigned long lastStatusLog = 0;
    static int statusCount = 0;
    static int collisionCount = 0;
    
    // Mostrar solo estados diferentes de OK (0) y timeout (valores comunes: 0=OK, otros=problemas/detecciones)
    if (status != MFRC522::STATUS_OK) {
      statusCount++;
      if (status == MFRC522::STATUS_COLLISION) {
        collisionCount++;
      }
      
      if (millis() - lastStatusLog > 5000) {
        Serial.print("🔍 Estado detectado: ");
        Serial.print(status);
        Serial.print(" (veces: ");
        Serial.print(statusCount);
        Serial.print(", colisiones: ");
        Serial.print(collisionCount);
        Serial.println(")");
        statusCount = 0;
        lastStatusLog = millis();
      }
      
      // Si hay demasiadas colisiones sin éxito, limpiar estado del módulo
      if (collisionCount > 100 && status == MFRC522::STATUS_COLLISION) {
        Serial.println("🔄 Demasiadas colisiones - reinicializando módulo...");
        mfrc522.PICC_HaltA();
        delay(50);
        mfrc522.PCD_Init();
        delay(50);
        mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
        mfrc522.PCD_AntennaOn();
        collisionCount = 0;
      }
    } else {
      // Si hay STATUS_OK, resetear contador de colisiones
      collisionCount = 0;
    }
    
    // Si se detecta un tag (OK o COLISIÓN)
    if (status == MFRC522::STATUS_OK || status == MFRC522::STATUS_COLLISION) {
      bool tagRead = false;
      String uid = "";
      
      // Limpiar estado antes de intentar leer
      mfrc522.PICC_HaltA();
      delay(10);
      
      // Si hay colisión, intentar múltiples métodos agresivos
      if (status == MFRC522::STATUS_COLLISION) {
        // Método 1: Intentar leer directamente
        if (mfrc522.PICC_ReadCardSerial()) {
          tagRead = true;
        }
        // Método 2: Si falla, usar RequestA con buffer más grande
        else {
          // Limpiar y reintentar con RequestA
          mfrc522.PICC_HaltA();
          delay(20);
          
          byte newBufferATQA[2];
          byte newBufferSize = sizeof(newBufferATQA);
          MFRC522::StatusCode newStatus = mfrc522.PICC_RequestA(newBufferATQA, &newBufferSize);
          
          if (newStatus == MFRC522::STATUS_OK || newStatus == MFRC522::STATUS_COLLISION) {
            if (mfrc522.PICC_ReadCardSerial()) {
              tagRead = true;
            }
          }
        }
        
        // Método 3: Si aún falla, intentar con Select después de RequestA
        if (!tagRead) {
          // Limpiar estado
          mfrc522.PICC_HaltA();
          delay(20);
          
          // Intentar RequestA nuevamente
          byte selectBufferATQA[2];
          byte selectBufferSize = sizeof(selectBufferATQA);
          MFRC522::StatusCode selectRequestStatus = mfrc522.PICC_RequestA(selectBufferATQA, &selectBufferSize);
          
          if (selectRequestStatus == MFRC522::STATUS_OK || selectRequestStatus == MFRC522::STATUS_COLLISION) {
            // Intentar leer directamente después de RequestA
            if (mfrc522.PICC_ReadCardSerial()) {
              tagRead = true;
            }
          }
        }
      } else {
        // Si es STATUS_OK, leer directamente
        if (mfrc522.PICC_ReadCardSerial()) {
          tagRead = true;
        }
      }
      
      // Si se pudo leer el tag
      if (tagRead) {
        // Obtener el UID
        for (byte i = 0; i < mfrc522.uid.size; i++) {
          if (mfrc522.uid.uidByte[i] < 0x10) {
            uid += "0";
          }
          uid += String(mfrc522.uid.uidByte[i], HEX);
        }
        uid.toUpperCase();
        
        // Verificar que el UID no esté vacío y tenga tamaño válido
        if (uid.length() > 0 && mfrc522.uid.size > 0 && mfrc522.uid.size <= 10) {
          // Aplicar debounce
          unsigned long currentTime = millis();
          if (uid != lastUID || (currentTime - lastReadTime) > DEBOUNCE_TIME) {
            lastUID = uid;
            lastReadTime = currentTime;
            successfulReads++;
            
            // Enviar JSON por Serial
            String jsonMessage = "{\"action\":\"entry\",\"uid\":\"" + uid + "\"}";
            Serial.println(jsonMessage);
            
            // Mensaje de confirmación
            if (status == MFRC522::STATUS_COLLISION) {
              Serial.print("✅ Tag detectado (colisión resuelta): ");
            } else {
              Serial.print("✅ Tag detectado: ");
            }
            Serial.println(uid);
          }
        } else {
          // Debug: mostrar qué se leyó
          static unsigned long lastDebugMsg = 0;
          if (millis() - lastDebugMsg > 5000) {
            Serial.print("⚠️ UID inválido - tamaño: ");
            Serial.print(mfrc522.uid.size);
            Serial.print(", longitud string: ");
            Serial.println(uid.length());
            lastDebugMsg = millis();
          }
          failedReads++;
        }
        
        // Detener comunicación con el tag
        mfrc522.PICC_HaltA();
        mfrc522.PCD_StopCrypto1();
        
        delay(100);
      } else {
        // Error al leer - mostrar debug ocasionalmente
        static unsigned long lastErrorMsg = 0;
        if (millis() - lastErrorMsg > 10000) {
          Serial.print("⚠️ No se pudo leer UID - Estado: ");
          Serial.print(status);
          Serial.println(" (¿hay un tag cerca del módulo?)");
          lastErrorMsg = millis();
        }
        failedReads++;
        mfrc522.PICC_HaltA();
        
        // Delay adaptativo según el estado
        if (status == MFRC522::STATUS_COLLISION) {
          consecutiveCollisions++;
          // Si hay muchas colisiones consecutivas, aumentar delay para dar tiempo al módulo
          if (consecutiveCollisions > 50) {
            delay(100);  // Delay mayor cuando hay muchas colisiones
          } else {
            delay(50);
          }
        } else {
          consecutiveCollisions = 0;
          delay(50);  // Delay normal cuando no hay colisiones
        }
      }
    } else {
      // Si no entró en ningún bloque de detección, delay normal
      consecutiveCollisions = 0;
      delay(50);
    }
  }
  
  // Delay mínimo al final del loop si no se procesó ningún método
  delay(25);
}





