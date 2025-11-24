@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema RFID + Medichat - Detener Servicios

echo.
echo ========================================
echo   DETENIENDO SERVICIOS
echo   Sistema RFID + Medichat
echo ========================================
echo.

REM Detener procesos por puerto
echo [1/2] Deteniendo servicios por puerto...
call :KillPort 3000
call :KillPort 3001
call :KillPort 5173
echo    [OK] Puertos liberados
echo.

REM Detener todos los procesos Node.js
echo [2/2] Deteniendo procesos Node.js...
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    [OK] Procesos Node.js detenidos
) else (
    echo    [INFO] No hay procesos Node.js en ejecucion
)
echo.

REM Esperar a que los procesos terminen
timeout /t 2 /nobreak >nul

REM Verificar que los puertos esten libres
echo Verificando puertos...
call :CheckPort 3000
call :CheckPort 3001
call :CheckPort 5173

echo.
echo ========================================
echo   SERVICIOS DETENIDOS
echo ========================================
echo.
echo    Todos los servicios han sido detenidos correctamente
echo.
timeout /t 3 /nobreak >nul

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
    echo    [INFO] Deteniendo proceso PID !PID! en puerto !PORT!...
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

:CheckPort
setlocal enabledelayedexpansion
set PORT=%1
netstat -ano | findstr ":!PORT!" | findstr "LISTENING" >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo    [OK] Puerto !PORT! liberado
) else (
    echo    [ADVERTENCIA] Puerto !PORT! aun en uso
)
endlocal
exit /b
