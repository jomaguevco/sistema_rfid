@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ========================================
REM   Gestor de Servidor - Sistema RFID Medical
REM ========================================

:menu
cls
echo ========================================
echo   GESTOR DE SERVIDOR - Sistema RFID Medical
echo ========================================
echo.
echo   1. Iniciar Servidor (Backend + Frontend)
echo   2. Detener Servidor
echo   3. Reiniciar Servidor
echo   4. Ver Estado del Servidor
echo   5. Salir
echo.
set /p opcion="Selecciona una opción (1-5): "

if "%opcion%"=="1" goto iniciar
if "%opcion%"=="2" goto detener
if "%opcion%"=="3" goto reiniciar
if "%opcion%"=="4" goto estado
if "%opcion%"=="5" goto salir
goto menu

:iniciar
echo.
echo ========================================
echo   INICIANDO SERVIDOR...
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no está instalado
    echo Por favor instala Node.js desde: https://nodejs.org/
    pause
    goto menu
)

echo [OK] Node.js encontrado
node --version
echo.

REM Verificar dependencias del backend
if not exist "backend\node_modules" (
    echo [INFO] Instalando dependencias del backend...
    cd backend
    call npm install
    cd ..
)

REM Verificar dependencias del frontend
if not exist "frontend\react\node_modules" (
    echo [INFO] Instalando dependencias del frontend...
    cd frontend\react
    call npm install
    cd ..\..
)

echo.
echo ========================================
echo   Iniciando servicios...
echo ========================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.

REM Detener procesos anteriores si existen
call :detener_procesos

REM Iniciar backend en nueva ventana y guardar PID
start "Backend - Sistema RFID" /min cmd /k "cd backend && npm run start:medical"
timeout /t 2 /nobreak >nul

REM Iniciar frontend en nueva ventana
start "Frontend - React" /min cmd /k "cd frontend\react && npm run dev"
timeout /t 2 /nobreak >nul

echo [OK] Servicios iniciados
echo.
echo Los servicios están corriendo en ventanas minimizadas.
echo Usa la opción 2 para detenerlos.
echo.
pause
goto menu

:detener
echo.
echo ========================================
echo   DETENIENDO SERVIDOR...
echo ========================================
echo.
call :detener_procesos
echo.
echo [OK] Servidor detenido
echo.
pause
goto menu

:detener_procesos
echo Deteniendo procesos de Node.js...
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Procesos detenidos correctamente
) else (
    echo [INFO] No se encontraron procesos de Node.js en ejecución
)
goto :eof

:reiniciar
echo.
echo ========================================
echo   REINICIANDO SERVIDOR...
echo ========================================
echo.
call :detener_procesos
timeout /t 2 /nobreak >nul
echo.
echo Iniciando servidor nuevamente...
timeout /t 2 /nobreak >nul
goto iniciar

:estado
echo.
echo ========================================
echo   ESTADO DEL SERVIDOR
echo ========================================
echo.
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo [ACTIVO] Servidor en ejecución
    echo.
    echo Procesos de Node.js activos:
    tasklist /FI "IMAGENAME eq node.exe" /FO TABLE
) else (
    echo [DETENIDO] No hay procesos de Node.js en ejecución
)
echo.
pause
goto menu

:salir
echo.
echo Saliendo...
exit /b 0

