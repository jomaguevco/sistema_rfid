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
  
  // Configurar ganancia de la antena para mejor detección
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
  
  // Activar la antena
  mfrc522.PCD_AntennaOn();
  
  // Usar configuración estándar del módulo (más confiable)
  // Las configuraciones personalizadas pueden causar problemas de detección
  
  Serial.println("✓ MFRC522 inicializado");
  Serial.println("✓ Antena activada con ganancia máxima\n");
  
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
    lastHeartbeat = millis();
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
  
  // MÉTODO PRINCIPAL: Buscar tags activamente
  // Usar PICC_RequestA que es el método más confiable
  byte bufferATQA[2];
  byte bufferSize = sizeof(bufferATQA);
  
  // Buscar tag tipo A
  MFRC522::StatusCode status = mfrc522.PICC_RequestA(bufferATQA, &bufferSize);
  
  // Si se detecta un tag
  if (status == MFRC522::STATUS_OK) {
    // Verificar que realmente hay un tag presente (doble verificación)
    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
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
      
      delay(200); // Delay después de leer para permitir que el tag se aleje
    } else {
      // Error al leer, detener y continuar
      mfrc522.PICC_HaltA();
      delay(50);
    }
  }
  
  // Delay mínimo para permitir que el módulo procese la búsqueda
  delay(25);  // Delay reducido para escaneo más rápido
}
