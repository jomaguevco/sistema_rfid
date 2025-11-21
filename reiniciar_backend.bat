@echo off
chcp 65001 >nul
echo ========================================
echo Reiniciando Backend - Sistema RFID
echo ========================================
echo.

echo Deteniendo procesos de Node.js...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo Iniciando backend...
cd backend
start "Backend - Sistema RFID" cmd /k "npm run start:medical"

echo.
echo ✓ Backend reiniciado en nueva ventana
echo.
echo Verifica en la ventana del backend que veas:
echo   ✓ Puerto serial abierto: COM3 a 115200 baud
echo.
pause

