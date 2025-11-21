@echo off
chcp 65001 >nul
echo ========================================
echo   DETENIENDO SERVIDOR - Sistema RFID Medical
echo ========================================
echo.
echo Deteniendo procesos de Node.js...
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Servidor detenido correctamente
) else (
    echo [INFO] No se encontraron procesos de Node.js en ejecución
)
echo.
pause

