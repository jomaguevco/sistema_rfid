@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema RFID + Medichat - Inicio Completo

echo.
echo ========================================
echo   SISTEMA RFID + MEDICHAT
echo   Inicio Completo
echo ========================================
echo.

REM ========================================
REM PASO 1: DETENER PROCESOS ANTERIORES
REM ========================================
echo [1/4] Deteniendo procesos anteriores...
call :KillPort 3000
call :KillPort 3001
call :KillPort 5173
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo    [OK] Procesos detenidos
echo.

REM ========================================
REM PASO 2: VERIFICAR NODE.JS
REM ========================================
echo [2/4] Verificando Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    [ERROR] Node.js no esta instalado
    pause
    exit /b 1
)
echo    [OK] Node.js encontrado
echo.

REM ========================================
REM PASO 3: VERIFICAR DIRECTORIOS
REM ========================================
echo [3/4] Verificando directorios...
if not exist "backend" (
    echo    [ERROR] Directorio backend no encontrado
    pause
    exit /b 1
)
if not exist "frontend\react" (
    echo    [ERROR] Directorio frontend\react no encontrado
    pause
    exit /b 1
)
if not exist "C:\Users\gonfr\Escritorio\medichat" (
    echo    [ERROR] Directorio medichat no encontrado
    pause
    exit /b 1
)
echo    [OK] Directorios verificados
echo.

REM ========================================
REM PASO 4: INICIAR SERVICIOS
REM ========================================
echo [4/4] Iniciando servicios...
echo.
echo    Backend:  http://localhost:3000
echo    Frontend: http://localhost:5173
echo    Medichat: http://localhost:3001
echo.
echo    Las ventanas se abriran automaticamente
echo    Presiona Ctrl+C en cada ventana para detener
echo.

REM Iniciar Backend
start "BACKEND RFID - Puerto 3000" cmd /k "cd /d %~dp0backend && echo ======================================== && echo   BACKEND RFID - Puerto 3000 && echo ======================================== && echo. && npm run start:medical"

REM Esperar antes de iniciar el siguiente
timeout /t 3 /nobreak >nul

REM Iniciar Frontend
start "FRONTEND RFID - Puerto 5173" cmd /k "cd /d %~dp0frontend\react && echo ======================================== && echo   FRONTEND RFID - Puerto 5173 && echo ======================================== && echo. && npm run dev"

REM Esperar antes de iniciar el siguiente
timeout /t 2 /nobreak >nul

REM Iniciar Medichat
start "MEDICHAT - WhatsApp Bot - Puerto 3001" cmd /k "cd /d C:\Users\gonfr\Escritorio\medichat && echo ======================================== && echo   MEDICHAT - WhatsApp Bot && echo   Puerto: 3001 && echo ======================================== && echo. && echo Generando codigo QR... && echo Escanea el QR que aparecera en la consola o en qr\qr.png && echo. && node src/app.js"

echo.
echo ========================================
echo   SERVICIOS INICIADOS
echo ========================================
echo.
echo    Servicios activos:
echo    - Backend RFID:  http://localhost:3000
echo    - Frontend RFID: http://localhost:5173
echo    - Medichat Bot:  http://localhost:3001
echo.
echo    IMPORTANTE:
echo    - Escanea el QR de WhatsApp en la ventana de Medichat
echo    - Espera a ver: "WhatsApp conectado exitosamente"
echo.
echo    Credenciales del sistema RFID:
echo    - Usuario: admin
echo    - Password: admin123
echo.
echo    Cierra esta ventana cuando quieras
echo    (Los servicios continuaran ejecutandose)
echo.
timeout /t 5 /nobreak >nul

goto :eof

REM ========================================
REM FUNCIONES AUXILIARES
REM ========================================

:KillPort
setlocal enabledelayedexpansion
set PORT=%1
set MAX_ATTEMPTS=5
set ATTEMPT=0

:kill_port_loop
set /a ATTEMPT+=1
if !ATTEMPT! GTR !MAX_ATTEMPTS! (
    endlocal
    exit /b
)

set PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":!PORT!" ^| findstr "LISTENING"') do (
    set PID=%%a
    goto :found_pid
)

:found_pid
if defined PID (
    taskkill /F /PID !PID! >nul 2>&1
    timeout /t 1 /nobreak >nul
    set PID=
)

netstat -ano | findstr ":!PORT!" | findstr "LISTENING" >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    endlocal
    exit /b
)

timeout /t 1 /nobreak >nul
goto :kill_port_loop
