/*
 * Script de Diagnóstico RC522 - ESP32
 * Este script ayuda a determinar si el módulo RC522 está dañado
 * 
 * CONEXIONES:
 * RC522 SDA  → ESP32 GPIO 2
 * RC522 RST  → ESP32 GPIO 15
 * RC522 MOSI → ESP32 GPIO 23
 * RC522 MISO → ESP32 GPIO 19
 * RC522 SCK  → ESP32 GPIO 18
 * RC522 3.3V → ESP32 3V3
 * RC522 GND  → ESP32 GND
 */

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN  2   // GPIO 2
#define RST_PIN 15  // GPIO 15

MFRC522 mfrc522(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n========================================");
  Serial.println("DIAGNÓSTICO RC522 - ESP32");
  Serial.println("========================================\n");
  
  // Configurar pin SS
  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  delay(10);
  
  // Inicializar SPI
  Serial.println("1. Inicializando SPI...");
  SPI.begin(18, 19, 23, SS_PIN);  // SCK, MISO, MOSI, SS
  delay(100);
  Serial.println("   ✓ SPI inicializado\n");
  
  // Intentar inicializar RC522
  Serial.println("2. Intentando inicializar RC522...");
  mfrc522.PCD_Init();
  delay(200);
  
  // Leer registro de versión (el más importante para diagnóstico)
  Serial.println("3. Leyendo registro de versión del chip...");
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  
  Serial.print("   Versión leída: 0x");
  if (version < 0x10) Serial.print("0");
  Serial.println(version, HEX);
  
  // Análisis de la versión
  Serial.println("\n4. ANÁLISIS DEL RESULTADO:");
  Serial.println("   ──────────────────────────────");
  
  if (version == 0x00) {
    Serial.println("   ❌ PROBLEMA CRÍTICO: Versión = 0x00");
    Serial.println("   ──────────────────────────────");
    Serial.println("   POSIBLES CAUSAS:");
    Serial.println("   1. Módulo NO conectado correctamente");
    Serial.println("   2. Módulo dañado (quemado)");
    Serial.println("   3. Alimentación incorrecta (usaste 5V en vez de 3.3V)");
    Serial.println("   4. Pin SDA (SS) desconectado o mal conectado");
    Serial.println("   5. Problema con comunicación SPI");
    Serial.println("\n   VERIFICACIONES:");
    Serial.println("   • Revisa TODAS las conexiones físicas");
    Serial.println("   • Verifica que usas 3.3V (NO 5V)");
    Serial.println("   • Prueba con otro módulo RC522 si tienes");
    Serial.println("   • Verifica continuidad con multímetro");
  }
  else if (version == 0xFF) {
    Serial.println("   ❌ PROBLEMA CRÍTICO: Versión = 0xFF");
    Serial.println("   ──────────────────────────────");
    Serial.println("   POSIBLES CAUSAS:");
    Serial.println("   1. Módulo NO conectado (pines flotantes)");
    Serial.println("   2. Módulo completamente dañado");
    Serial.println("   3. Pin MISO desconectado o mal conectado");
    Serial.println("   4. Problema grave con SPI");
    Serial.println("\n   VERIFICACIONES:");
    Serial.println("   • Revisa especialmente el pin MISO (GPIO 19)");
    Serial.println("   • Verifica que el módulo recibe alimentación");
    Serial.println("   • Prueba con otro módulo RC522");
  }
  else {
    // Versiones válidas conocidas: 0x91, 0x92, 0x88, 0x90, 0xB2
    Serial.println("   ✓ Versión válida detectada");
    Serial.println("   ──────────────────────────────");
    Serial.println("   El módulo está COMUNICÁNDOSE correctamente");
    Serial.println("   Versiones válidas conocidas: 0x91, 0x92, 0x88, 0x90, 0xB2");
    
    // Leer más registros para diagnóstico completo
    Serial.println("\n5. DIAGNÓSTICO ADICIONAL:");
    Serial.println("   ──────────────────────────────");
    
    // Leer registro de comando
    byte commandReg = mfrc522.PCD_ReadRegister(mfrc522.CommandReg);
    Serial.print("   Comando Reg: 0x");
    if (commandReg < 0x10) Serial.print("0");
    Serial.println(commandReg, HEX);
    
    // Leer registro de control
    byte comIrqReg = mfrc522.PCD_ReadRegister(mfrc522.ComIrqReg);
    Serial.print("   ComIrq Reg: 0x");
    if (comIrqReg < 0x10) Serial.print("0");
    Serial.println(comIrqReg, HEX);
    
    // Verificar antena
    Serial.println("\n6. Verificando antena...");
    mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
    mfrc522.PCD_AntennaOn();
    
    byte antennaGain = mfrc522.PCD_ReadRegister(mfrc522.RFCfgReg);
    Serial.print("   Ganancia de antena: 0x");
    if (antennaGain < 0x10) Serial.print("0");
    Serial.println(antennaGain, HEX);
    Serial.println("   ✓ Antena activada");
    
    Serial.println("\n7. PRUEBA DE DETECCIÓN:");
    Serial.println("   ──────────────────────────────");
    Serial.println("   Acerca un tag RFID al módulo...");
    Serial.println("   (Tienes 30 segundos)\n");
    
    // Intentar detectar tags durante 30 segundos
    unsigned long startTime = millis();
    bool tagDetected = false;
    
    while (millis() - startTime < 30000) {
      // Buscar tag
      if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
        Serial.println("   ✅ TAG DETECTADO!");
        Serial.print("   UID: ");
        for (byte i = 0; i < mfrc522.uid.size; i++) {
          if (mfrc522.uid.uidByte[i] < 0x10) Serial.print("0");
          Serial.print(mfrc522.uid.uidByte[i], HEX);
          Serial.print(" ");
        }
        Serial.println();
        tagDetected = true;
        mfrc522.PICC_HaltA();
        break;
      }
      delay(100);
      
      // Mostrar progreso cada 5 segundos
      if ((millis() - startTime) % 5000 < 100) {
        Serial.print("   Esperando tag... (");
        Serial.print((30000 - (millis() - startTime)) / 1000);
        Serial.println("s restantes)");
      }
    }
    
    if (!tagDetected) {
      Serial.println("\n   ⚠️ No se detectó ningún tag");
      Serial.println("   Esto puede significar:");
      Serial.println("   • El tag está muy lejos");
      Serial.println("   • La antena tiene problemas");
      Serial.println("   • El módulo tiene problemas de detección");
      Serial.println("   • Pero la COMUNICACIÓN SPI funciona");
    }
    
    Serial.println("\n========================================");
    Serial.println("CONCLUSIÓN:");
    Serial.println("✓ El módulo RC522 está FUNCIONANDO");
    Serial.println("✓ La comunicación SPI es correcta");
    if (tagDetected) {
      Serial.println("✓ La detección de tags funciona");
    } else {
      Serial.println("⚠ La detección de tags necesita más pruebas");
    }
    Serial.println("========================================\n");
  }
  
  Serial.println("\nPresiona RESET para ejecutar diagnóstico nuevamente");
}

void loop() {
  // No hacer nada en el loop, solo diagnóstico en setup
  delay(1000);
}

