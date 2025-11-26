# 🏥 Sistema de Gestión de Stock Médico con RFID

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/MySQL-8.0-orange?style=for-the-badge&logo=mysql" alt="MySQL">
  <img src="https://img.shields.io/badge/ESP32-RFID-red?style=for-the-badge&logo=espressif" alt="ESP32">
  <img src="https://img.shields.io/badge/Socket.IO-Real--time-purple?style=for-the-badge&logo=socket.io" alt="Socket.IO">
</p>

Sistema integral para la gestión de inventario de medicamentos e insumos médicos en instituciones de salud, utilizando tecnología **RFID** para el seguimiento automatizado del stock en tiempo real.

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración del Hardware](#-configuración-del-hardware)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Módulos del Sistema](#-módulos-del-sistema)
- [API REST](#-api-rest)
- [Base de Datos](#-base-de-datos)
- [Predicciones de Consumo](#-predicciones-de-consumo)
- [Seguridad](#-seguridad)
- [Uso del Sistema](#-uso-del-sistema)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Características

### 📦 Gestión de Inventario
- **Control de stock en tiempo real** con tecnología RFID
- **Gestión de lotes** con fechas de vencimiento y trazabilidad
- **Múltiples categorías** de productos (medicamentos, insumos, equipos)
- **Control por áreas/departamentos** (Urgencias, Cirugía, Pediatría, etc.)
- **Historial completo** de movimientos de stock

### 🏷️ Tecnología RFID
- **Lectura automática** de tags RFID con ESP32 + RC522
- **Múltiples tags por lote** para seguimiento granular
- **Detección en tiempo real** vía WebSocket
- **Diagnóstico automático** del módulo RFID

### 📊 Predicciones y Análisis
- **Motor de predicción** con múltiples algoritmos:
  - Promedio móvil simple y ponderado
  - Regresión lineal para tendencias
  - Factores de estacionalidad
  - Escenarios externos (epidemias, campañas)
- **Predicciones** mensuales, trimestrales y anuales
- **Niveles de confianza** basados en datos históricos

### 🚨 Sistema de Alertas
- **Stock bajo** - Productos bajo el mínimo
- **Próximos a vencer** - Alertas de caducidad
- **Productos vencidos** - Identificación automática
- **Predicciones insuficientes** - Stock futuro en riesgo

### 📋 Prescripciones Médicas
- **Gestión de recetas** electrónicas
- **Despacho controlado** con QR
- **Trazabilidad médico-paciente**
- **Historial de dispensaciones**

### 👥 Gestión de Usuarios
- **Roles diferenciados**: Admin, Farmacéutico, Farmacéutico Jefe, Enfermero, Supervisor, Auditor, Despacho
- **Autenticación JWT** segura
- **Auditoría completa** de acciones
- **Control de permisos** granular

### 📈 Reportes y Exportación
- **Reportes programados** (diarios, semanales, mensuales)
- **Exportación** en PDF, Excel, CSV
- **Envío automático** por email
- **Dashboard interactivo** con gráficos

### 🔔 Notificaciones
- **Integración con WhatsApp** para alertas críticas
- **Notificaciones por email**
- **Webhooks** para integración externa

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │Dashboard│ │ Stock   │ │Productos│ │Recetas  │ │Reportes │  ...       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘            │
└───────┼──────────┼──────────┼──────────┼──────────┼─────────────────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        API REST                                    │   │
│  │  /api/products  /api/batches  /api/prescriptions  /api/reports   │   │
│  │  /api/alerts    /api/predictions  /api/users  /api/dashboard     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Auth      │  │  WebSocket  │  │  Serial     │  │ Predictions │    │
│  │   (JWT)     │  │  (Socket.IO)│  │  Handler    │  │   Engine    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└───────┬─────────────────┬────────────────┬──────────────────────────────┘
        │                 │                │
        ▼                 ▼                ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    MySQL      │ │   Socket.IO   │ │  ESP32 RFID   │
│   Database    │ │   Clients     │ │   RC522       │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## 📋 Requisitos Previos

### Software
| Componente | Versión Mínima | Descripción |
|------------|----------------|-------------|
| Node.js | 18.x o superior | Runtime de JavaScript |
| MySQL | 8.0 o MariaDB 10.4 | Base de datos relacional |
| npm | 9.x o superior | Gestor de paquetes |
| Git | 2.x | Control de versiones |

### Hardware (Opcional para RFID)
| Componente | Descripción |
|------------|-------------|
| ESP32 | Microcontrolador WiFi/Bluetooth |
| RC522 | Módulo lector RFID 13.56MHz |
| Tags RFID | Tarjetas o llaveros MIFARE |
| Cable USB | Para conexión serial |

---

## 🚀 Instalación

### 1. Clonar el Repositorio
```bash
git clone https://github.com/jomaguevco/sistema_rfid.git
cd sistema_rfid
```

### 2. Configurar Base de Datos
```bash
# Crear base de datos
mysql -u root -p < database/schema_medical.sql
```

### 3. Instalar Dependencias del Backend
```bash
cd backend
npm install
```

### 4. Configurar Variables de Entorno
Crear archivo `.env` en `/backend`:
```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de datos MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=rfid_stock_db
DB_PORT=3306

# JWT
JWT_SECRET=tu_clave_secreta_muy_segura_aqui
JWT_EXPIRES_IN=24h

# Serial (RFID)
SERIAL_PORT=COM4
BAUD_RATE=115200

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password

# WhatsApp (opcional)
WHATSAPP_API_URL=http://localhost:3001
```

### 5. Instalar Dependencias del Frontend
```bash
cd frontend/react
npm install
```

### 6. Crear Usuario Administrador
```bash
cd backend
node create_admin.js
```

### 7. Iniciar el Sistema

**Windows (archivo batch):**
```bash
# Desde la raíz del proyecto
./iniciar.bat
```

**Manual:**
```bash
# Terminal 1: Backend
cd backend
npm run start:medical

# Terminal 2: Frontend
cd frontend/react
npm run dev
```

### 8. Acceder al Sistema
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
- **Documentación API:** http://localhost:3000/api-docs

---

## 🔧 Configuración del Hardware

### Conexión ESP32 + RC522

```
┌─────────────────┐          ┌─────────────────┐
│     RC522       │          │      ESP32      │
│                 │          │                 │
│  SDA ──────────────────────── GPIO 2        │
│  SCK ──────────────────────── GPIO 18       │
│  MOSI ─────────────────────── GPIO 23       │
│  MISO ─────────────────────── GPIO 19       │
│  RST ──────────────────────── GPIO 15       │
│  GND ──────────────────────── GND           │
│  3.3V ─────────────────────── 3V3           │
└─────────────────┘          └─────────────────┘
```

### Cargar Firmware al ESP32

1. Instalar Arduino IDE con soporte ESP32
2. Instalar librería MFRC522
3. Abrir `arduino/rfid_stock_monitor_esp32/rfid_stock_monitor_esp32.ino`
4. Seleccionar placa ESP32 y puerto COM
5. Cargar el sketch

### Verificar Conexión RFID
El sistema mostrará en consola:
```
✓ Sistema RFID iniciado correctamente
✓ Esperando tags RFID...
💓 Sistema activo, escuchando tags...
```

---

## 📁 Estructura del Proyecto

```
sistema_rfid/
├── arduino/                          # Código ESP32
│   ├── rfid_stock_monitor_esp32/     # Monitor de stock RFID
│   │   └── rfid_stock_monitor_esp32.ino
│   └── rfid_diagnostico_esp32/       # Herramienta de diagnóstico
│       ├── rfid_diagnostico_esp32.ino
│       └── GUIA_DIAGNOSTICO.md
├── backend/                          # Servidor Node.js
│   ├── server_medical.js             # Servidor principal
│   ├── database_medical.js           # Conexión y queries MySQL
│   ├── serialHandler_medical.js      # Comunicación serial RFID
│   ├── package.json
│   ├── middleware/                   # Middlewares Express
│   │   ├── auth.js                   # Autenticación JWT
│   │   ├── permissions.js            # Control de permisos
│   │   ├── rateLimiter.js            # Limitador de requests
│   │   ├── validation.js             # Validación de entrada
│   │   └── audit.js                  # Auditoría de acciones
│   ├── routes/                       # Endpoints API
│   │   ├── products_medical.js       # CRUD productos
│   │   ├── batches.js                # Gestión de lotes
│   │   ├── prescriptions.js          # Recetas médicas
│   │   ├── predictions.js            # Predicciones consumo
│   │   ├── alerts.js                 # Sistema de alertas
│   │   ├── dashboard.js              # Datos del dashboard
│   │   ├── reports.js                # Generación reportes
│   │   ├── auth.js                   # Login/logout
│   │   ├── users.js                  # Gestión usuarios
│   │   ├── doctors.js                # Gestión médicos
│   │   ├── patients.js               # Gestión pacientes
│   │   └── ...
│   ├── utils/                        # Utilidades
│   │   ├── predictionEngine.js       # Motor de predicciones
│   │   ├── reportGenerator.js        # Generador de reportes
│   │   ├── backup.js                 # Sistema de backups
│   │   ├── email.js                  # Envío de emails
│   │   └── swagger.js                # Documentación API
│   ├── services/                     # Servicios externos
│   │   └── whatsappService.js        # Integración WhatsApp
│   └── scripts/                      # Scripts de utilidad
│       ├── populate_all_data.js      # Poblar datos de prueba
│       └── generate_real_stock_history.js
├── frontend/                         # Interfaz de usuario
│   ├── react/                        # Aplicación React
│   │   ├── src/
│   │   │   ├── App.jsx               # Componente principal
│   │   │   ├── main.jsx              # Entrada de la app
│   │   │   ├── pages/                # Páginas
│   │   │   │   ├── Dashboard.jsx     # Panel principal
│   │   │   │   ├── Stock.jsx         # Gestión de stock
│   │   │   │   ├── Products.jsx      # Productos
│   │   │   │   ├── Prescriptions.jsx # Recetas
│   │   │   │   ├── Predictions.jsx   # Predicciones
│   │   │   │   ├── Reports.jsx       # Reportes
│   │   │   │   ├── Alerts.jsx        # Alertas
│   │   │   │   ├── Users.jsx         # Usuarios
│   │   │   │   ├── Doctors.jsx       # Médicos
│   │   │   │   ├── Patients.jsx      # Pacientes
│   │   │   │   └── Login.jsx         # Inicio de sesión
│   │   │   ├── components/           # Componentes reutilizables
│   │   │   │   ├── common/           # Componentes base
│   │   │   │   ├── dashboard/        # Componentes del dashboard
│   │   │   │   ├── predictions/      # Componentes de predicciones
│   │   │   │   ├── prescriptions/    # Componentes de recetas
│   │   │   │   └── products/         # Componentes de productos
│   │   │   └── context/              # Context API
│   │   │       └── AuthContext.jsx   # Estado de autenticación
│   │   ├── package.json
│   │   └── vite.config.js
│   └── legacy/                       # Frontend anterior (HTML/JS)
├── database/                         # Scripts SQL
│   ├── schema_medical.sql            # Schema principal
│   ├── schema_auth.sql               # Autenticación
│   ├── schema_prescriptions.sql      # Prescripciones
│   └── ...
├── backups/                          # Backups automáticos
├── iniciar.bat                       # Script de inicio Windows
├── detener.bat                       # Script de detención Windows
└── README.md                         # Esta documentación
```

---

## 🔌 Módulos del Sistema

### 1. Dashboard
- **Resumen general** del inventario
- **Gráficos interactivos**:
  - Distribución por categorías
  - Tendencia de consumo
  - Productos próximos a vencer
  - Predicciones resumidas
- **KPIs principales**: Total productos, stock bajo, alertas activas

### 2. Gestión de Stock
- **Entrada de productos** con lector RFID o manual
- **Salida de productos** automática al detectar RFID
- **Historial de movimientos** por producto/lote
- **Transferencias entre áreas**

### 3. Productos y Lotes
- **CRUD completo** de productos
- **Gestión de lotes** con:
  - Número de lote
  - Fecha de vencimiento
  - Cantidad disponible
  - Tags RFID asociados
- **Información médica**: Principio activo, concentración, presentación

### 4. Prescripciones
- **Creación de recetas** electrónicas
- **Asignación de médico** y paciente
- **Despacho controlado** con código QR
- **Estados**: Pendiente, Parcialmente dispensada, Completada

### 5. Predicciones
- **Cálculo automático** de consumo futuro
- **Períodos**: Mensual, Trimestral, Anual
- **Algoritmos**:
  - Promedio móvil simple
  - Promedio móvil ponderado
  - Regresión lineal combinada
- **Factores de ajuste**: Estacionalidad, escenarios externos
- **Stock de seguridad** recomendado

### 6. Alertas
- **Tipos de alerta**:
  - `low_stock`: Stock bajo mínimo
  - `expiring_soon`: Próximo a vencer (30 días)
  - `expired`: Producto vencido
  - `prediction_insufficient`: Stock futuro insuficiente
- **Severidad**: Baja, Media, Alta, Crítica
- **Resolución manual** con seguimiento

### 7. Reportes
- **Tipos de reporte**:
  - Productos vencidos
  - Próximos a vencer
  - Stock bajo
  - Consumo por área
  - Trazabilidad
  - Predicciones
- **Formatos**: PDF, Excel, CSV
- **Programación automática**

---

## 🔗 API REST

### Autenticación
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### Endpoints Principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| **Productos** |
| GET | `/api/products` | Listar productos |
| POST | `/api/products` | Crear producto |
| GET | `/api/products/:id` | Obtener producto |
| PUT | `/api/products/:id` | Actualizar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| **Lotes** |
| GET | `/api/batches` | Listar lotes |
| POST | `/api/batches` | Crear lote |
| GET | `/api/batches/expiring` | Lotes por vencer |
| **Prescripciones** |
| GET | `/api/prescriptions` | Listar prescripciones |
| POST | `/api/prescriptions` | Crear prescripción |
| POST | `/api/prescriptions/:id/dispense` | Dispensar medicamento |
| **Predicciones** |
| GET | `/api/predictions` | Obtener predicciones |
| POST | `/api/predictions/generate` | Generar predicciones |
| **Alertas** |
| GET | `/api/alerts` | Listar alertas |
| PUT | `/api/alerts/:id/resolve` | Resolver alerta |
| **Dashboard** |
| GET | `/api/dashboard/stats` | Estadísticas generales |
| GET | `/api/dashboard/consumption` | Datos de consumo |

### Ejemplo de Uso
```javascript
// Obtener productos con autenticación
const response = await fetch('http://localhost:3000/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
```

---

## 🗄️ Base de Datos

### Diagrama Simplificado

```
┌──────────────────┐     ┌──────────────────┐
│ product_categories│     │      areas       │
├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │
│ name             │     │ name             │
│ description      │     │ is_active        │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │   ┌────────────────────┘
         │   │
         ▼   ▼
┌──────────────────┐     ┌──────────────────┐
│     products     │     │  stock_history   │
├──────────────────┤     ├──────────────────┤
│ id               │◄────│ product_id       │
│ name             │     │ batch_id         │
│ product_type     │     │ area_id          │
│ category_id      │     │ action           │
│ min_stock        │     │ previous_stock   │
│ rfid_uid         │     │ new_stock        │
└────────┬─────────┘     └──────────────────┘
         │
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ product_batches  │     │  stock_alerts    │
├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │
│ product_id       │◄────│ product_id       │
│ lot_number       │     │ batch_id         │
│ expiry_date      │     │ alert_type       │
│ quantity         │     │ severity         │
│ rfid_uid         │     │ is_resolved      │
└────────┬─────────┘     └──────────────────┘
         │
         ▼
┌──────────────────┐
│ batch_rfid_tags  │
├──────────────────┤
│ id               │
│ batch_id         │
│ rfid_uid         │
└──────────────────┘
```

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `products` | Medicamentos e insumos |
| `product_batches` | Lotes con fecha de vencimiento |
| `batch_rfid_tags` | Tags RFID asociados a lotes |
| `stock_history` | Historial de movimientos |
| `stock_alerts` | Alertas del sistema |
| `consumption_predictions` | Predicciones de consumo |
| `users` | Usuarios del sistema |
| `prescriptions` | Recetas médicas |
| `doctors` | Médicos |
| `patients` | Pacientes |
| `suppliers` | Proveedores |
| `purchase_orders` | Órdenes de compra |

---

## 📈 Predicciones de Consumo

### Algoritmos Implementados

#### 1. Promedio Móvil Simple
```javascript
// Promedio de los últimos N días
average = sum(lastNDays) / N
```

#### 2. Promedio Móvil Ponderado
```javascript
// Más peso a datos recientes
weighted = (d1*1 + d2*2 + ... + dn*n) / (1+2+...+n)
```

#### 3. Regresión Lineal
```javascript
// Detecta tendencias
prediction = intercept + (slope * futureDays)
```

### Factores de Ajuste

- **Estacionalidad**: Variación según época del año
- **Escenarios externos**:
  - Campañas de vacunación (+8%)
  - Alertas epidemiológicas (+15%)
  - Entregas extraordinarias (-5%)

### Ejemplo de Predicción
```json
{
  "predicted_quantity": 150,
  "adjusted_prediction": 165,
  "confidence_level": 75,
  "algorithm_used": "weighted_moving_average",
  "seasonality_factor": 1.05,
  "external_adjustment": {
    "note": "Campaña de vacunación regional",
    "demandMultiplier": 1.08,
    "extraDemand": 25
  },
  "recommended_safety_stock": 33
}
```

---

## 🔒 Seguridad

### Autenticación
- **JWT (JSON Web Tokens)** para sesiones
- **Tokens con expiración** configurable
- **Refresh tokens** para renovación segura

### Autorización
- **Control de acceso por roles**
- **Permisos granulares** por acción
- **Middleware de verificación** en cada endpoint

### Protección de Datos
- **Contraseñas hasheadas** con bcrypt
- **Sanitización de entrada** contra XSS
- **Headers de seguridad** con Helmet
- **CORS** configurado

### Rate Limiting
- **100 requests/15min** para API general
- **5 intentos/15min** para login
- **10 requests/min** para operaciones sensibles

### Auditoría
- **Log de todas las acciones** críticas
- **Registro de IP** y user-agent
- **Historial de cambios** en registros

---

## 💻 Uso del Sistema

### Flujo de Trabajo Típico

1. **Inicio de Sesión**
   - Ingresar credenciales
   - Sistema asigna token JWT

2. **Gestión de Inventario**
   - Registrar nuevos productos
   - Crear lotes con fecha de vencimiento
   - Asignar tags RFID a lotes

3. **Control de Stock**
   - Detectar automáticamente salidas con RFID
   - Registrar entradas manualmente
   - Ver historial de movimientos

4. **Prescripciones**
   - Médico crea receta
   - Farmacéutico verifica disponibilidad
   - Despacho con código QR

5. **Análisis y Reportes**
   - Revisar predicciones de consumo
   - Generar reportes periódicos
   - Atender alertas del sistema

---

## 🐛 Troubleshooting

### El RFID no detecta tags
1. Verificar conexiones físicas
2. Comprobar alimentación 3.3V (no 5V)
3. Revisar logs del ESP32 en Monitor Serial
4. Ejecutar diagnóstico: `arduino/rfid_diagnostico_esp32`

### Error de conexión a MySQL
```bash
# Verificar servicio
sudo systemctl status mysql

# Verificar credenciales en .env
# Probar conexión manual
mysql -u root -p rfid_stock_db
```

### El frontend no conecta al backend
1. Verificar que el backend esté corriendo en puerto 3000
2. Revisar configuración CORS
3. Verificar token JWT válido

### Error en predicciones
- Requiere mínimo 7 días de datos históricos
- Verificar que existan movimientos de tipo "remove"
- Revisar logs del backend

---

## 📧 Soporte

- **Repositorio:** https://github.com/jomaguevco/sistema_rfid
- **Issues:** Reportar problemas en GitHub Issues
- **Desarrollador:** Jose Mariano Guevara Cotrina

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Puedes usarlo, modificarlo y distribuirlo libremente.

---

**Desarrollado con ❤️ para instituciones de salud**

