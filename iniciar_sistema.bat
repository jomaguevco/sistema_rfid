@echo off
echo ========================================
echo   Iniciando Sistema RFID Stock Medical
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado
    echo Por favor instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
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
echo Presiona Ctrl+C en cada ventana para detener
echo.

REM Iniciar backend en nueva ventana
start "Backend - Sistema RFID" cmd /k "cd backend && npm run start:medical"

REM Esperar un poco para que el backend inicie
timeout /t 3 /nobreak >nul

REM Iniciar frontend en nueva ventana
start "Frontend - React" cmd /k "cd frontend\react && npm run dev"

echo.
echo [OK] Servicios iniciados en ventanas separadas
echo.
pause

