@echo off
REM Script de inicio rápido para Sistema Médico RFID (Windows)
REM Uso: iniciar.bat

echo.
echo ========================================
echo   Sistema Medico RFID - Inicio Rapido
echo ========================================
echo.

REM Verificar si Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado
    echo Por favor instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js encontrado
node --version

REM Verificar dependencias
if not exist "backend\node_modules" (
    echo.
    echo [INFO] Instalando dependencias...
    cd backend
    call npm install
    cd ..
    echo [OK] Dependencias instaladas
) else (
    echo [OK] Dependencias instaladas
)

REM Verificar archivo de base de datos
if not exist "database\schema_medical.sql" (
    echo [ERROR] Archivo schema_medical.sql no encontrado
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Iniciando servidor medico...
echo ========================================
echo.
echo Notas:
echo   - El servidor se iniciara en: http://localhost:3000
echo   - Presiona Ctrl+C para detener el servidor
echo   - Verifica que MySQL este ejecutandose
echo.

cd backend
call npm run start:medical

pause

