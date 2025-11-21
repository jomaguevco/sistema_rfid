@echo off
chcp 65001 >nul
echo.
echo ========================================
echo Subir a GitHub - Modo Rápido
echo ========================================
echo.
echo Ejecuta este comando reemplazando TU_URL con la URL de tu repositorio:
echo.
echo git remote add origin TU_URL ^&^& git branch -M main ^&^& git push -u origin main
echo.
echo O simplemente ingresa la URL aquí:
echo.
set /p REPO_URL="URL del repositorio: "

if "%REPO_URL%"=="" (
    echo Error: Debes proporcionar una URL
    pause
    exit /b 1
)

echo.
echo Configurando remoto...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo.
echo Subiendo código...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo Error. Verifica tus credenciales de GitHub.
    echo Puedes usar GitHub Desktop o un Personal Access Token.
    pause
    exit /b 1
)

echo.
echo ¡Listo! Tu código está en GitHub.
pause

