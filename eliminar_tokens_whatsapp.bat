@echo off
chcp 65001 >nul
title Eliminar Tokens WhatsApp - Baileys Session

echo.
echo ========================================
echo   ELIMINAR TOKENS WHATSAPP BUSINESS
echo ========================================
echo.
echo Buscando carpeta tokens\baileys-session...
echo.

REM Buscar y eliminar en ubicaciones comunes
if exist "tokens\baileys-session" (
    echo [OK] Carpeta encontrada en: tokens\baileys-session
    rmdir /s /q "tokens\baileys-session"
    echo [OK] Carpeta eliminada correctamente
    goto :success
)

if exist "backend\tokens\baileys-session" (
    echo [OK] Carpeta encontrada en: backend\tokens\baileys-session
    rmdir /s /q "backend\tokens\baileys-session"
    echo [OK] Carpeta eliminada correctamente
    goto :success
)

if exist "tokens" (
    echo [OK] Carpeta tokens encontrada
    rmdir /s /q "tokens"
    echo [OK] Carpeta tokens eliminada completamente
    goto :success
)

if exist "backend\tokens" (
    echo [OK] Carpeta backend\tokens encontrada
    rmdir /s /q "backend\tokens"
    echo [OK] Carpeta tokens eliminada completamente
    goto :success
)

echo [INFO] Carpeta tokens\baileys-session no encontrada en ubicaciones comunes
echo.
echo La carpeta puede estar en otro directorio o ya fue eliminada.
echo Si usas medichat, la carpeta puede estar en el directorio de medichat.
echo.
echo Buscando en directorio padre...
cd ..
if exist "tokens\baileys-session" (
    echo [OK] Carpeta encontrada en directorio padre
    rmdir /s /q "tokens\baileys-session"
    echo [OK] Carpeta eliminada correctamente
    goto :success
)

echo [ADVERTENCIA] No se encontro la carpeta tokens\baileys-session
echo.
echo Ubicaciones verificadas:
echo   - tokens\baileys-session
echo   - backend\tokens\baileys-session
echo   - tokens
echo   - backend\tokens
echo   - ..\tokens\baileys-session
echo.
goto :end

:success
echo.
echo ========================================
echo   TOKENS ELIMINADOS CORRECTAMENTE
echo ========================================
echo.
echo La sesion de WhatsApp Business ha sido eliminada.
echo Ahora puedes reiniciar el sistema y escanear el QR nuevamente.
echo.
goto :end

:end
pause

