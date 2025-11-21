@echo off
echo ========================================
echo   Iniciando Sistema RFID Stock Medical
echo ========================================
echo.
echo Configurando puerto serial: COM3
echo Velocidad: 115200 baud
echo.

cd backend

REM Configurar variables de entorno
set SERIAL_PORT=COM3
set BAUD_RATE=115200

echo Iniciando servidor Node.js...
echo.
node server_medical.js

pause

