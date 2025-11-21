# Instrucciones para subir el repositorio a GitHub

## Paso 1: Crear el repositorio en GitHub

1. Ve a https://github.com/new (ya debería estar abierto en tu navegador)
2. Nombre del repositorio: `Sistema_rfid` (o el que prefieras)
3. **IMPORTANTE**: NO marques ninguna de estas opciones:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license
4. Haz clic en **"Create repository"**

## Paso 2: Copiar la URL del repositorio

Una vez creado, GitHub te mostrará una página con instrucciones. Copia la URL que aparece, por ejemplo:
- `https://github.com/tu-usuario/Sistema_rfid.git`

## Paso 3: Ejecutar los comandos

Una vez que tengas la URL, ejecuta estos comandos en la terminal (reemplaza `TU_URL_AQUI` con la URL que copiaste):

```bash
git remote add origin TU_URL_AQUI
git branch -M main
git push -u origin main
```

O simplemente ejecuta el script automático:

```bash
.\subir_github.bat
```

Y cuando te pida la URL, pégala.

## Solución de problemas

### Si aparece un error de autenticación:

1. **Opción 1: Usar GitHub Desktop**
   - Descarga GitHub Desktop desde https://desktop.github.com/
   - Inicia sesión con tu cuenta de GitHub
   - El repositorio se subirá automáticamente

2. **Opción 2: Usar Personal Access Token (PAT)**
   - Ve a https://github.com/settings/tokens
   - Genera un nuevo token con permisos `repo`
   - Cuando Git te pida la contraseña, usa el token en su lugar

3. **Opción 3: Configurar Git Credential Manager**
   ```bash
   git config --global credential.helper manager-core
   ```

### Si el remoto ya existe:

```bash
git remote set-url origin TU_URL_AQUI
git push -u origin main
```

## Verificar que se subió correctamente

Ve a tu repositorio en GitHub y verifica que todos los archivos estén presentes.

