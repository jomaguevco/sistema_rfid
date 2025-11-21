@echo off
chcp 65001 >nul
echo ========================================
echo Subir repositorio a GitHub
echo ========================================
echo.

REM Verificar si ya existe un remoto
git remote get-url origin >nul 2>&1
if %errorlevel% equ 0 (
    echo Ya existe un remoto configurado.
    git remote get-url origin
    echo.
    set /p CONTINUAR="¿Deseas actualizar el remoto y subir el código? (S/N): "
    if /i not "%CONTINUAR%"=="S" (
        echo Operación cancelada.
        pause
        exit /b 0
    )
    echo.
    set /p REPO_URL="Ingresa la nueva URL del repositorio (o presiona Enter para usar la actual): "
    if not "%REPO_URL%"=="" (
        git remote set-url origin %REPO_URL%
        echo Remoto actualizado.
    )
) else (
    echo.
    echo PASO 1: Crear repositorio en GitHub
    echo ----------------------------------------
    echo 1. Abre tu navegador y ve a: https://github.com/new
    echo 2. Nombre sugerido: Sistema_rfid
    echo 3. NO marques "Add a README file"
    echo 4. NO marques "Add .gitignore"
    echo 5. NO marques "Choose a license"
    echo 6. Haz clic en "Create repository"
    echo.
    echo Abriendo GitHub en tu navegador...
    start https://github.com/new
    echo.
    echo Espera a que crees el repositorio...
    timeout /t 5 >nul
    echo.
    set /p REPO_URL="PASO 2: Ingresa la URL de tu repositorio (ej: https://github.com/tu-usuario/Sistema_rfid.git): "

    if "%REPO_URL%"=="" (
        echo Error: Debes proporcionar una URL
        pause
        exit /b 1
    )

    echo.
    echo Agregando remoto...
    git remote add origin %REPO_URL%
    if errorlevel 1 (
        echo Error al agregar el remoto. Puede que ya exista.
        pause
        exit /b 1
    )
)

echo.
echo PASO 3: Subiendo código a GitHub...
echo ----------------------------------------
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR al subir el código
    echo ========================================
    echo.
    echo Posibles soluciones:
    echo 1. Verifica que la URL del repositorio sea correcta
    echo 2. Asegúrate de tener permisos para escribir en el repositorio
    echo 3. Verifica tus credenciales de GitHub
    echo 4. Si es la primera vez, puede que necesites autenticarte
    echo.
    echo Para autenticarte, puedes usar:
    echo - GitHub Desktop
    echo - Personal Access Token (PAT)
    echo - Git Credential Manager
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ¡Repositorio subido exitosamente!
echo ========================================
echo.
echo Tu código está ahora en: %REPO_URL%
echo.
pause

