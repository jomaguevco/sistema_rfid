@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema RFID + Medichat - Inicio Completo

echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo   INICIANDO SISTEMA COMPLETO
echo      Backend RFID de Gestion Medica
echo      Frontend React (Vite)
echo      MediChat - Bot de WhatsApp
echo ════════════════════════════════════════════════════════════════════════════════
echo.

REM Obtener directorio del script
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "RFID_DIR=%SCRIPT_DIR%"
set "FRONTEND_DIR=%SCRIPT_DIR%\frontend\react"
set "MEDICHAT_DIR=C:\Users\gonfr\Escritorio\medichat"
set "PID_FILE=%SCRIPT_DIR%\.running_pids"
set "LOGS_DIR=%SCRIPT_DIR%\logs"

REM Limpiar archivo de PIDs
if exist "%PID_FILE%" del "%PID_FILE%"
type nul > "%PID_FILE%"

REM ════════════════════════════════════════════════════════════════════════════════
REM VERIFICACIONES PREVIAS
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo VERIFICACIONES PREVIAS
echo ────────────────────────────────────────────────────────────────────────────────
echo.

REM Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    [ERROR] Node.js no esta instalado
    echo    Instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo    [OK] Node.js instalado: %NODE_VERSION%

REM Verificar npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    [ERROR] npm no esta instalado
    pause
    exit /b 1
)
echo    [OK] npm instalado

REM Verificar MySQL (opcional)
where mysql >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    [WARN] MySQL CLI no encontrado - opcional
) else (
    echo    [OK] MySQL CLI disponible
)

REM Verificar directorios
set "FRONTEND_AVAILABLE=true"
set "MEDICHAT_AVAILABLE=true"

if not exist "%RFID_DIR%\backend" (
    echo    [ERROR] Directorio backend RFID no encontrado
    pause
    exit /b 1
)
echo    [OK] Directorio Backend RFID encontrado

if not exist "%FRONTEND_DIR%" (
    echo    [WARN] Directorio Frontend no encontrado
    set "FRONTEND_AVAILABLE=false"
) else (
    echo    [OK] Directorio Frontend React encontrado
)

if not exist "%MEDICHAT_DIR%" (
    echo    [WARN] Directorio MediChat no encontrado
    echo       El bot de WhatsApp no se iniciara
    set "MEDICHAT_AVAILABLE=false"
) else (
    echo    [OK] Directorio MediChat encontrado
)
echo.

REM ════════════════════════════════════════════════════════════════════════════════
REM VERIFICAR DEPENDENCIAS
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo VERIFICANDO DEPENDENCIAS
echo ────────────────────────────────────────────────────────────────────────────────
echo.

REM Verificar node_modules del backend RFID
if not exist "%RFID_DIR%\backend\node_modules" (
    echo    Instalando dependencias del backend RFID...
    cd /d "%RFID_DIR%\backend"
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo    [ERROR] Error instalando dependencias RFID
        pause
        exit /b 1
    )
) else (
    echo    [OK] Dependencias Backend RFID instaladas
)

REM Verificar node_modules del frontend
if "%FRONTEND_AVAILABLE%"=="true" (
    if not exist "%FRONTEND_DIR%\node_modules" (
        echo    Instalando dependencias del Frontend React...
        cd /d "%FRONTEND_DIR%"
        npm install
        if %ERRORLEVEL% NEQ 0 (
            echo    [ERROR] Error instalando dependencias Frontend
            set "FRONTEND_AVAILABLE=false"
        )
    ) else (
        echo    [OK] Dependencias Frontend React instaladas
    )
)

REM Verificar node_modules de MediChat
if "%MEDICHAT_AVAILABLE%"=="true" (
    if not exist "%MEDICHAT_DIR%\node_modules" (
        echo    Instalando dependencias de MediChat...
        cd /d "%MEDICHAT_DIR%"
        npm install
        if %ERRORLEVEL% NEQ 0 (
            echo    [ERROR] Error instalando dependencias MediChat
            set "MEDICHAT_AVAILABLE=false"
        )
    ) else (
        echo    [OK] Dependencias MediChat instaladas
    )
)
echo.

REM ════════════════════════════════════════════════════════════════════════════════
REM LIBERAR PUERTOS SI ES NECESARIO
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo VERIFICANDO PUERTOS
echo ────────────────────────────────────────────────────────────────────────────────
echo.

call :CheckAndKillPort 3000 "Backend RFID"
call :CheckAndKillPort 5173 "Frontend React"
call :CheckAndKillPort 3001 "MediChat API"

echo.

REM Crear directorio de logs
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

REM ════════════════════════════════════════════════════════════════════════════════
REM INICIAR SERVICIOS
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo INICIANDO SERVICIOS
echo ────────────────────────────────────────────────────────────────────────────────
echo.
echo    Backend:  http://localhost:3000
echo    Frontend: http://localhost:5173
echo    Medichat: http://localhost:3001
echo.
echo    Las ventanas se abriran automaticamente
echo    Presiona Ctrl+C en cada ventana para detener
echo.

REM Iniciar Backend RFID
echo    Iniciando Backend RFID...
start "BACKEND RFID - Puerto 3000" cmd /k "cd /d %RFID_DIR%\backend && echo ======================================== && echo   BACKEND RFID - Puerto 3000 && echo ======================================== && echo. && npm run start:medical"

REM Esperar antes de iniciar el siguiente
timeout /t 3 /nobreak >nul

REM Iniciar Frontend React
if "%FRONTEND_AVAILABLE%"=="true" (
    echo    Iniciando Frontend React...
    start "FRONTEND RFID - Puerto 5173" cmd /k "cd /d %FRONTEND_DIR% && echo ======================================== && echo   FRONTEND RFID - Puerto 5173 && echo ======================================== && echo. && npm run dev"
    
    REM Esperar antes de iniciar el siguiente
    timeout /t 2 /nobreak >nul
)

REM Iniciar MediChat
if "%MEDICHAT_AVAILABLE%"=="true" (
    REM Verificar .env
    if not exist "%MEDICHAT_DIR%\.env" (
        if exist "%MEDICHAT_DIR%\.env.example" (
            echo    [WARN] Creando .env desde .env.example en MediChat
            copy "%MEDICHAT_DIR%\.env.example" "%MEDICHAT_DIR%\.env" >nul
        )
    )
    
    echo    Iniciando MediChat...
    start "MEDICHAT - WhatsApp Bot - Puerto 3001" cmd /k "cd /d %MEDICHAT_DIR% && echo ======================================== && echo   MEDICHAT - WhatsApp Bot && echo   Puerto: 3001 && echo ======================================== && echo. && echo Generando codigo QR... && echo Escanea el QR que aparecera en la consola o en qr\qr.png && echo. && node src/app.js"
)

REM ════════════════════════════════════════════════════════════════════════════════
REM OBTENER IP LOCAL
REM ════════════════════════════════════════════════════════════════════════════════

set "LOCAL_IP="
for /f "tokens=14" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    if not defined LOCAL_IP set "LOCAL_IP=%%a"
)

REM ════════════════════════════════════════════════════════════════════════════════
REM RESUMEN FINAL
REM ════════════════════════════════════════════════════════════════════════════════

echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo   SERVICIOS INICIADOS
echo ════════════════════════════════════════════════════════════════════════════════
echo.
echo    Servicios activos desde esta PC:
echo    - Backend RFID:  http://localhost:3000
echo    - Frontend RFID: https://localhost:5173
echo    - Medichat Bot:  http://localhost:3001
echo.
if defined LOCAL_IP (
    echo    Acceso desde MOVIL - misma red WiFi:
    echo    - Frontend: https://%LOCAL_IP%:5173
    echo    - Backend:  http://%LOCAL_IP%:3000
    echo.
    echo    PARA USAR LA CAMARA EN MOVIL:
    echo    1. Abre https://%LOCAL_IP%:5173 en tu navegador movil
    echo    2. Acepta la advertencia del certificado - es seguro
    echo    3. Ahora podras usar la camara para escanear QR
    echo.
    echo    NOTA: El sistema detecta automaticamente la IP.
    echo    Si cambias de red WiFi, solo reinicia el sistema.
    echo.
)
echo    IMPORTANTE:
echo    - Escanea el QR de WhatsApp en la ventana de Medichat
echo    - Espera a ver: WhatsApp conectado exitosamente
echo.
echo    Credenciales del sistema RFID:
echo.
echo    ADMINISTRADOR:
echo    - Usuario: admin
echo    - Password: admin123
echo.
echo    QUIMICO FARMACEUTICO:
echo    - Usuario: quimico1
echo    - Password: quimico123
echo.
echo    MEDICO:
echo    - Usuario: medico_juan_perez
echo    - Password: medico123
echo.
echo    Cierra esta ventana cuando quieras
echo    Los servicios continuaran ejecutandose
echo.
timeout /t 5 /nobreak >nul

goto :eof

REM ════════════════════════════════════════════════════════════════════════════════
REM FUNCIONES AUXILIARES
REM ════════════════════════════════════════════════════════════════════════════════

:CheckAndKillPort
setlocal enabledelayedexpansion
set PORT=%1
set NAME=%~2

netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo    [WARN] Puerto %PORT% en uso - %NAME%
    set /p KILL_PORT="       Deseas liberarlo? (s/n): "
    if /i "!KILL_PORT!"=="s" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
            taskkill /F /PID %%a >nul 2>&1
        )
        timeout /t 1 /nobreak >nul
        echo       [OK] Puerto %PORT% liberado
    ) else (
        echo       [ERROR] No se puede continuar sin el puerto %PORT%
        endlocal
        exit /b 1
    )
) else (
    echo    [OK] Puerto %PORT% disponible - %NAME%
)
endlocal
exit /b 0
