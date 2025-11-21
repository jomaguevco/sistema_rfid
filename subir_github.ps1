# Script para subir repositorio a GitHub
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Subir repositorio a GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si ya existe un remoto
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "Ya existe un remoto configurado: $existingRemote" -ForegroundColor Yellow
    $continuar = Read-Host "¿Deseas actualizar el remoto y subir el código? (S/N)"
    if ($continuar -ne "S" -and $continuar -ne "s") {
        Write-Host "Operación cancelada." -ForegroundColor Yellow
        exit
    }
    Write-Host ""
    $repoUrl = Read-Host "Ingresa la nueva URL del repositorio (o presiona Enter para usar la actual)"
    if ($repoUrl) {
        git remote set-url origin $repoUrl
        Write-Host "Remoto actualizado." -ForegroundColor Green
    }
} else {
    Write-Host "PASO 1: Crear repositorio en GitHub" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    Write-Host "1. Abre tu navegador y ve a: https://github.com/new"
    Write-Host "2. Nombre sugerido: Sistema_rfid"
    Write-Host "3. NO marques 'Add a README file'"
    Write-Host "4. NO marques 'Add .gitignore'"
    Write-Host "5. NO marques 'Choose a license'"
    Write-Host "6. Haz clic en 'Create repository'"
    Write-Host ""
    
    # Abrir GitHub en el navegador
    Start-Process "https://github.com/new"
    
    Write-Host "Esperando 5 segundos..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
    Write-Host ""
    
    $repoUrl = Read-Host "PASO 2: Ingresa la URL de tu repositorio (ej: https://github.com/tu-usuario/Sistema_rfid.git)"
    
    if (-not $repoUrl) {
        Write-Host "Error: Debes proporcionar una URL" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Agregando remoto..." -ForegroundColor Yellow
    git remote add origin $repoUrl
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error al agregar el remoto. Puede que ya exista." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "PASO 3: Subiendo código a GitHub..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow

# Asegurar que estamos en la rama main
git branch -M main

# Subir el código
git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR al subir el código" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Posibles soluciones:" -ForegroundColor Yellow
    Write-Host "1. Verifica que la URL del repositorio sea correcta"
    Write-Host "2. Asegúrate de tener permisos para escribir en el repositorio"
    Write-Host "3. Verifica tus credenciales de GitHub"
    Write-Host "4. Si es la primera vez, puede que necesites autenticarte"
    Write-Host ""
    Write-Host "Para autenticarte, puedes usar:" -ForegroundColor Cyan
    Write-Host "- GitHub Desktop"
    Write-Host "- Personal Access Token (PAT)"
    Write-Host "- Git Credential Manager"
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "¡Repositorio subido exitosamente!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tu código está ahora en: $repoUrl" -ForegroundColor Cyan
Write-Host ""

