@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Eliminar Tokens WhatsApp - Baileys Session

cls
echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo   🗑️  ELIMINAR TOKENS WHATSAPP BUSINESS
echo ════════════════════════════════════════════════════════════════════════════════
echo.
echo Buscando carpetas de sesión de WhatsApp...
echo.

REM Obtener directorio del script
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "MEDICHAT_DIR=C:\Users\gonfr\Escritorio\medichat"
set "PARENT_DIR=%SCRIPT_DIR%\.."

set "FOUND=false"

REM ════════════════════════════════════════════════════════════════════════════════
REM BUSCAR EN SISTEMA RFID
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo 📁 BUSCANDO EN SISTEMA RFID
echo ────────────────────────────────────────────────────────────────────────────────
echo.

REM tokens/baileys-session (raíz RFID)
if exist "%SCRIPT_DIR%\tokens\baileys-session" (
    echo    ✅ Carpeta encontrada: tokens\baileys-session ^(raíz RFID^)
    echo       📁 %SCRIPT_DIR%\tokens\baileys-session
    rmdir /s /q "%SCRIPT_DIR%\tokens\baileys-session"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM tokens (raíz RFID)
if exist "%SCRIPT_DIR%\tokens" (
    echo    ✅ Carpeta encontrada: tokens ^(raíz RFID^)
    echo       📁 %SCRIPT_DIR%\tokens
    rmdir /s /q "%SCRIPT_DIR%\tokens"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM backend/tokens/baileys-session
if exist "%SCRIPT_DIR%\backend\tokens\baileys-session" (
    echo    ✅ Carpeta encontrada: backend\tokens\baileys-session
    echo       📁 %SCRIPT_DIR%\backend\tokens\baileys-session
    rmdir /s /q "%SCRIPT_DIR%\backend\tokens\baileys-session"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM backend/tokens
if exist "%SCRIPT_DIR%\backend\tokens" (
    echo    ✅ Carpeta encontrada: backend\tokens
    echo       📁 %SCRIPT_DIR%\backend\tokens
    rmdir /s /q "%SCRIPT_DIR%\backend\tokens"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM auth_info_baileys (raíz RFID)
if exist "%SCRIPT_DIR%\auth_info_baileys" (
    echo    ✅ Carpeta encontrada: auth_info_baileys ^(raíz RFID^)
    echo       📁 %SCRIPT_DIR%\auth_info_baileys
    rmdir /s /q "%SCRIPT_DIR%\auth_info_baileys"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM backend/auth_info_baileys
if exist "%SCRIPT_DIR%\backend\auth_info_baileys" (
    echo    ✅ Carpeta encontrada: backend\auth_info_baileys
    echo       📁 %SCRIPT_DIR%\backend\auth_info_baileys
    rmdir /s /q "%SCRIPT_DIR%\backend\auth_info_baileys"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM ════════════════════════════════════════════════════════════════════════════════
REM BUSCAR EN MEDICHAT
REM ════════════════════════════════════════════════════════════════════════════════

if exist "%MEDICHAT_DIR%" (
    echo ────────────────────────────────────────────────────────────────────────────────
    echo 💬 BUSCANDO EN MEDICHAT
    echo ────────────────────────────────────────────────────────────────────────────────
    echo.
    
    REM medichat/tokens/baileys-session
    if exist "%MEDICHAT_DIR%\tokens\baileys-session" (
        echo    ✅ Carpeta encontrada: medichat\tokens\baileys-session
        echo       📁 %MEDICHAT_DIR%\tokens\baileys-session
        rmdir /s /q "%MEDICHAT_DIR%\tokens\baileys-session"
        if !ERRORLEVEL! EQU 0 (
            echo       ✅ Eliminada correctamente
            set "FOUND=true"
        ) else (
            echo       ❌ Error al eliminar
        )
        echo.
    )
    
    REM medichat/tokens
    if exist "%MEDICHAT_DIR%\tokens" (
        echo    ✅ Carpeta encontrada: medichat\tokens
        echo       📁 %MEDICHAT_DIR%\tokens
        rmdir /s /q "%MEDICHAT_DIR%\tokens"
        if !ERRORLEVEL! EQU 0 (
            echo       ✅ Eliminada correctamente
            set "FOUND=true"
        ) else (
            echo       ❌ Error al eliminar
        )
        echo.
    )
    
    REM medichat/auth_info_baileys
    if exist "%MEDICHAT_DIR%\auth_info_baileys" (
        echo    ✅ Carpeta encontrada: medichat\auth_info_baileys
        echo       📁 %MEDICHAT_DIR%\auth_info_baileys
        rmdir /s /q "%MEDICHAT_DIR%\auth_info_baileys"
        if !ERRORLEVEL! EQU 0 (
            echo       ✅ Eliminada correctamente
            set "FOUND=true"
        ) else (
            echo       ❌ Error al eliminar
        )
        echo.
    )
    
    REM medichat/.wwebjs_auth
    if exist "%MEDICHAT_DIR%\.wwebjs_auth" (
        echo    ✅ Carpeta encontrada: medichat\.wwebjs_auth
        echo       📁 %MEDICHAT_DIR%\.wwebjs_auth
        rmdir /s /q "%MEDICHAT_DIR%\.wwebjs_auth"
        if !ERRORLEVEL! EQU 0 (
            echo       ✅ Eliminada correctamente
            set "FOUND=true"
        ) else (
            echo       ❌ Error al eliminar
        )
        echo.
    )
    
    REM medichat/.wwebjs_cache
    if exist "%MEDICHAT_DIR%\.wwebjs_cache" (
        echo    ✅ Carpeta encontrada: medichat\.wwebjs_cache
        echo       📁 %MEDICHAT_DIR%\.wwebjs_cache
        rmdir /s /q "%MEDICHAT_DIR%\.wwebjs_cache"
        if !ERRORLEVEL! EQU 0 (
            echo       ✅ Eliminada correctamente
            set "FOUND=true"
        ) else (
            echo       ❌ Error al eliminar
        )
        echo.
    )
)

REM ════════════════════════════════════════════════════════════════════════════════
REM BUSCAR EN DIRECTORIO PADRE
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo 📂 BUSCANDO EN DIRECTORIO PADRE
echo ────────────────────────────────────────────────────────────────────────────────
echo.

REM tokens/baileys-session (directorio padre)
if exist "%PARENT_DIR%\tokens\baileys-session" (
    echo    ✅ Carpeta encontrada: tokens\baileys-session ^(directorio padre^)
    echo       📁 %PARENT_DIR%\tokens\baileys-session
    rmdir /s /q "%PARENT_DIR%\tokens\baileys-session"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM tokens (directorio padre)
if exist "%PARENT_DIR%\tokens" (
    echo    ✅ Carpeta encontrada: tokens ^(directorio padre^)
    echo       📁 %PARENT_DIR%\tokens
    rmdir /s /q "%PARENT_DIR%\tokens"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    ) else (
        echo       ❌ Error al eliminar
    )
    echo.
)

REM ════════════════════════════════════════════════════════════════════════════════
REM BUSCAR ARCHIVOS DE SESIÓN ADICIONALES
REM ════════════════════════════════════════════════════════════════════════════════

echo ────────────────────────────────────────────────────────────────────────────────
echo 🔍 BUSCANDO ARCHIVOS DE SESIÓN ADICIONALES
echo ────────────────────────────────────────────────────────────────────────────────
echo.

REM Buscar carpetas .wwebjs* en RFID
for /d %%D in ("%SCRIPT_DIR%\.wwebjs*") do (
    echo    ✅ Carpeta encontrada: %%~nxD
    echo       📁 %%D
    rmdir /s /q "%%D"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    )
    echo.
)

REM Buscar carpetas session-* en RFID
for /d %%D in ("%SCRIPT_DIR%\session-*") do (
    echo    ✅ Carpeta de sesión encontrada: %%~nxD
    echo       📁 %%D
    rmdir /s /q "%%D"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    )
    echo.
)

REM Buscar carpetas .wwebjs* en backend
for /d %%D in ("%SCRIPT_DIR%\backend\.wwebjs*") do (
    echo    ✅ Carpeta encontrada: backend\%%~nxD
    echo       📁 %%D
    rmdir /s /q "%%D"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    )
    echo.
)

REM Buscar carpetas session-* en backend
for /d %%D in ("%SCRIPT_DIR%\backend\session-*") do (
    echo    ✅ Carpeta de sesión encontrada: backend\%%~nxD
    echo       📁 %%D
    rmdir /s /q "%%D"
    if !ERRORLEVEL! EQU 0 (
        echo       ✅ Eliminada correctamente
        set "FOUND=true"
    )
    echo.
)

REM Buscar en MediChat también
if exist "%MEDICHAT_DIR%" (
    for /d %%D in ("%MEDICHAT_DIR%\.wwebjs*") do (
        echo    ✅ Carpeta encontrada: medichat\%%~nxD
        echo       📁 %%D
        rmdir /s /q "%%D"
        if !ERRORLEVEL! EQU 0 (
            echo       ✅ Eliminada correctamente
            set "FOUND=true"
        )
        echo.
    )
    
    for /d %%D in ("%MEDICHAT_DIR%\session-*") do (
        echo    ✅ Carpeta de sesión encontrada: medichat\%%~nxD
        echo       📁 %%D
        rmdir /s /q "%%D"
        if !ERRORLEVEL! EQU 0 (
            echo       ✅ Eliminada correctamente
            set "FOUND=true"
        )
        echo.
    )
)

REM ════════════════════════════════════════════════════════════════════════════════
REM RESUMEN
REM ════════════════════════════════════════════════════════════════════════════════

echo.
echo ════════════════════════════════════════════════════════════════════════════════
if "%FOUND%"=="true" (
    echo   ✅ TOKENS ELIMINADOS CORRECTAMENTE
    echo ════════════════════════════════════════════════════════════════════════════════
    echo.
    echo La sesión de WhatsApp Business ha sido eliminada.
    echo Ahora puedes reiniciar el sistema y escanear el QR nuevamente.
) else (
    echo   ⚠️  NO SE ENCONTRARON CARPETAS DE TOKENS
    echo ════════════════════════════════════════════════════════════════════════════════
    echo.
    echo No se encontraron carpetas de sesión de WhatsApp.
    echo Es posible que ya hayan sido eliminadas o que nunca se crearon.
)

echo.
echo ────────────────────────────────────────────────────────────────────────────────
echo 📋 Ubicaciones verificadas:
echo    • tokens\baileys-session
echo    • tokens
echo    • backend\tokens\baileys-session
echo    • backend\tokens
echo    • auth_info_baileys
echo    • medichat\tokens
echo    • .wwebjs_auth
echo    • .wwebjs_cache
echo ────────────────────────────────────────────────────────────────────────────────
echo.

pause
