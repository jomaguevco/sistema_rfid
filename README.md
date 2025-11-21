# Sistema de Gestión de Stock Médico con RFID

Sistema completo de gestión de inventario médico con detección automática mediante RFID.

## 🚀 Inicio Rápido

### 1. Configuración Inicial

```bash
cd backend
node verificar_sistema.js
```

Este script verifica y configura:
- ✅ Conexión a base de datos AWS RDS
- ✅ Creación de tablas necesarias
- ✅ Usuario administrador

### 2. Iniciar Servidor

```bash
cd backend
node server_medical.js
```

O usar el script:
```bash
iniciar_rfid.bat
```

### 3. Acceder al Sistema

Abre en el navegador: `http://localhost:3000`

**Credenciales:**
- Username: `admin`
- Password: `admin123`

## 📋 Flujo del Sistema

### Flujo Principal: Retiro de Productos con RFID

```
1. ESP32 (RFID) → Detecta tag RFID
   ↓
2. Envía JSON por Serial USB:
   {"action":"remove","uid":"A1B2C3D4"}
   ↓
3. Backend (Node.js) → Recibe mensaje serial
   ↓
4. Emite evento Socket.IO: 'rfidDetected'
   ↓
5. Frontend → Muestra modal para seleccionar área
   ↓
6. Usuario selecciona área y confirma
   ↓
7. Backend → Procesa retiro:
   - Busca producto/lote por RFID
   - Valida que no esté vencido
   - Decrementa stock (FIFO)
   - Registra en historial
   ↓
8. Backend → Emite eventos Socket.IO:
   - 'stockUpdated'
   - 'alertsUpdated'
   ↓
9. Frontend → Actualiza automáticamente:
   - Dashboard
   - Lista de productos
   - Alertas
   - Notificaciones
```

### Flujo: Gestión de Productos

```
1. Crear Producto
   - Nombre, tipo, categoría
   - Stock mínimo
   - Campos médicos
   ↓
2. Crear Lote
   - Asociar a producto
   - Número de lote
   - Fecha de vencimiento
   - Cantidad
   - Asignar RFID (opcional)
   ↓
3. Asignar RFID a Lote
   - Acercar tag al lector ESP32
   - Sistema detecta y asigna automáticamente
```

### Flujo: Alertas Automáticas

```
1. Sistema verifica periódicamente:
   - Stock bajo (menor a mínimo)
   - Productos próximos a vencer
   - Productos vencidos
   ↓
2. Genera alertas automáticas
   ↓
3. Muestra en dashboard y panel de alertas
```

## 🔧 Configuración

### Variables de Entorno

Archivo: `backend/.env`

```env
PORT=3000
DB_HOST=recetariowebqr.c38qyu046ryr.us-east-2.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=J0nxtxn13052003_
DB_NAME=rfid_stock_db
JWT_SECRET=supersecreto_2025
SERIAL_PORT=COM3
BAUD_RATE=115200
```

### Hardware ESP32

**Conexiones:**
- SDA → GPIO 2
- SCK → GPIO 18
- MOSI → GPIO 23
- MISO → GPIO 19
- RST → GPIO 15
- 3.3V → 3V3
- GND → GND

Ver: `arduino/rfid_stock_monitor_esp32/CONEXIONES.md`

## 📁 Estructura del Proyecto

```
ARDUINO/
├── arduino/
│   └── rfid_stock_monitor_esp32/
│       ├── rfid_stock_monitor_esp32.ino  # Código ESP32
│       ├── CONEXIONES.md                  # Conexiones hardware
│       └── INSTRUCCIONES_INSTALACION.md   # Instalación librerías
├── backend/
│   ├── server_medical.js                  # Servidor principal
│   ├── database_medical.js                # Funciones BD
│   ├── serialHandler_medical.js           # Comunicación serial
│   ├── verificar_sistema.js                # Script verificación
│   ├── create_admin.js                    # Crear usuario admin
│   ├── .env                               # Variables de entorno
│   ├── routes/                            # Rutas API
│   ├── middleware/                        # Middlewares
│   └── utils/                             # Utilidades
├── frontend/
│   ├── index_medical.html                 # Interfaz principal
│   ├── login.html                         # Página de login
│   ├── js/                                # JavaScript frontend
│   └── css/                               # Estilos
└── database/
    ├── schema_medical.sql                 # Esquema BD médico
    ├── schema_auth.sql                    # Esquema autenticación
    └── schema_suppliers.sql               # Esquema proveedores
```

## 🎯 Funcionalidades Principales

### Gestión de Stock
- ✅ Productos médicos con campos específicos
- ✅ Control de lotes con fechas de vencimiento
- ✅ Sistema FIFO (First In, First Out)
- ✅ Trazabilidad completa

### RFID
- ✅ Detección automática de tags
- ✅ Asignación de RFID a lotes
- ✅ Retiro automático con selección de área
- ✅ Validación de productos vencidos

### Alertas
- ✅ Stock bajo
- ✅ Productos próximos a vencer
- ✅ Productos vencidos
- ✅ Notificaciones en tiempo real

### Reportes
- ✅ Historial de movimientos
- ✅ Trazabilidad por producto/lote
- ✅ Exportación CSV/Excel
- ✅ Reportes programados

## 🔐 Seguridad

- Autenticación JWT
- Roles y permisos
- Auditoría de acciones
- Rate limiting
- Validación de datos

## 📚 Documentación Adicional

- `arduino/rfid_stock_monitor_esp32/CONEXIONES.md` - Conexiones hardware
- `arduino/rfid_stock_monitor_esp32/INSTRUCCIONES_INSTALACION.md` - Instalación librerías Arduino

## 🛠️ Scripts Útiles

```bash
# Verificar sistema
node backend/verificar_sistema.js

# Crear/actualizar usuario admin
node backend/create_admin.js

# Iniciar servidor
node backend/server_medical.js
# O
iniciar_rfid.bat
```

## ⚠️ Notas Importantes

1. **Base de datos**: Configurada en AWS RDS, no requiere MySQL local
2. **Puerto serial**: Configurado en COM3 por defecto (cambiar en `.env` si es necesario)
3. **RFID**: El sistema detecta tags automáticamente cuando están cerca del lector
4. **Áreas**: Deben crearse antes de poder procesar retiros

## 🐛 Solución de Problemas

### Error 500 en login
- Verificar que la base de datos esté accesible
- Ejecutar: `node backend/verificar_sistema.js`

### RFID no detecta
- Verificar conexiones del módulo RC522
- Verificar que el ESP32 esté conectado por USB
- Revisar Serial Monitor del ESP32

### Puerto serial no se abre
- Verificar que el ESP32 esté conectado
- Cambiar `SERIAL_PORT` en `.env` o `serialHandler_medical.js`
