@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema RFID + Medichat - Detener Sistema Completo

echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo   DETENIENDO SISTEMA COMPLETO
echo      Backend RFID de Gestion Medica
echo      Frontend React (Vite)
echo      MediChat - Bot de WhatsApp
echo ════════════════════════════════════════════════════════════════════════════════
echo.

REM Obtener directorio del script
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "PID_FILE=%SCRIPT_DIR%\.running_pids"

set "PROCESSES_FOUND=0"

REM ════════════════════════════════════════════════════════════════════════════════
REM LIBERANDO PUERTOS
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo LIBERANDO PUERTOS
echo ────────────────────────────────────────────────────────────────────────────────
echo.

REM Puerto 3000 - Backend RFID
call :KillPort 3000 "Backend RFID"

REM Puerto 5173 - Frontend Vite
call :KillPort 5173 "Frontend React"

REM Puerto 5174 - Frontend Vite (alternativo)
call :KillPort 5174 "Frontend React Alt"

REM Puerto 3001 - MediChat API
call :KillPort 3001 "MediChat API"

echo.

REM ════════════════════════════════════════════════════════════════════════════════
REM DETENER PROCESOS NODE
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo DETENIENDO PROCESOS NODE
echo ────────────────────────────────────────────────────────────────────────────────
echo.

REM Detener todos los procesos Node.js
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo    Deteniendo procesos Node.js...
    taskkill /F /IM node.exe >nul 2>&1
    echo    [OK] Procesos Node.js detenidos
    set /a PROCESSES_FOUND+=1
) else (
    echo    [INFO] No hay procesos Node.js en ejecucion
)

echo.

REM Esperar a que los procesos terminen
timeout /t 2 /nobreak >nul

REM ════════════════════════════════════════════════════════════════════════════════
REM VERIFICACION FINAL
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo VERIFICACION FINAL
echo ────────────────────────────────────────────────────────────────────────────────
echo.

call :CheckPortFree 3000
call :CheckPortFree 5173
call :CheckPortFree 3001

echo.

REM Limpiar archivo de PIDs si existe
if exist "%PID_FILE%" del "%PID_FILE%"

REM ════════════════════════════════════════════════════════════════════════════════
REM RESUMEN
REM ════════════════════════════════════════════════════════════════════════════════

echo.
echo ════════════════════════════════════════════════════════════════════════════════
if %PROCESSES_FOUND% EQU 0 (
    echo   [INFO] No se encontraron procesos activos
) else (
    echo   [OK] SISTEMA DETENIDO CORRECTAMENTE
)
echo ════════════════════════════════════════════════════════════════════════════════
echo.
echo    Para iniciar nuevamente el sistema:
echo       iniciar.bat
echo.
echo    Para eliminar sesion de WhatsApp:
echo       eliminar_tokens_whatsapp.bat
echo.
echo ────────────────────────────────────────────────────────────────────────────────
echo.

timeout /t 3 /nobreak >nul
goto :eof

REM ════════════════════════════════════════════════════════════════════════════════
REM FUNCIONES AUXILIARES
REM ════════════════════════════════════════════════════════════════════════════════

:KillPort
set PORT=%1
set NAME=%~2

set "FOUND_PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set "FOUND_PID=%%a"
)

if defined FOUND_PID (
    echo    Deteniendo proceso en puerto %PORT% - %NAME%...
    taskkill /F /PID %FOUND_PID% >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo    [OK] Puerto %PORT% liberado
    set /a PROCESSES_FOUND+=1
)
goto :eof

:CheckPortFree
set PORT=%1
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    [OK] Puerto %PORT% liberado
) else (
    echo    [WARN] Puerto %PORT% aun en uso
)
goto :eof
