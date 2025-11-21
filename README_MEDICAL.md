# Sistema de Gestión de Stock para Medicamentos e Insumos Médicos

Sistema completo para monitorear y gestionar el stock de medicamentos e insumos médicos con control de vencimientos, lotes, trazabilidad, alertas automáticas y predicción inteligente de consumo.

## 🎯 Características Principales

### Funcionalidades Médicas Específicas
- ✅ **Control de Vencimientos**: Detección automática de productos vencidos y por vencer
- ✅ **Gestión de Lotes**: Sistema completo de lotes con números de lote y fechas de vencimiento
- ✅ **Trazabilidad Completa**: Registro de cada retiro con lote, área y fecha/hora exacta
- ✅ **Alertas Automáticas**: Sistema de alertas para productos vencidos, por vencer y stock bajo
- ✅ **Gestión de Áreas**: Asignación de retiros a áreas/departamentos médicos específicos
- ✅ **Campos Médicos**: Principio activo, concentración, presentación, vía de administración
- ✅ **Predicción de Consumo**: Análisis predictivo para próximo mes, trimestre y año
- ✅ **Predicciones por Área**: Análisis de consumo por departamento/área médica
- ✅ **Dashboard Médico**: Panel con métricas clave y alertas prioritarias
- ✅ **Validaciones de Seguridad**: Bloqueo de retiro de productos vencidos, validación FIFO

## 📋 Requisitos

### Hardware
- Arduino Uno (o compatible)
- Módulo RFID RC522
- Tags RFID (tarjetas o etiquetas)
- Cables de conexión
- Cable USB para conectar Arduino a la computadora

### Software
- Node.js (v14 o superior)
- MySQL (v5.7 o superior, o MariaDB)
- Arduino IDE (para cargar el código al Arduino)
- Navegador web moderno

## 🔌 Conexiones del Hardware

Conecta el módulo RC522 al Arduino según la siguiente tabla:

| RC522 Pin | Arduino Pin |
|-----------|-------------|
| SDA (SS)  | 10          |
| SCK       | 13          |
| MOSI      | 11          |
| MISO      | 12          |
| IRQ       | No conectado|
| GND       | GND         |
| RST       | 9           |
| 3.3V      | 3.3V        |

**⚠️ IMPORTANTE**: El RC522 funciona a 3.3V, NO uses 5V o podrías dañarlo.

## 📦 Instalación

### 1. Configurar Base de Datos MySQL

```bash
# Conectarse a MySQL
mysql -u root -p

# Ejecutar el script de creación de base de datos MÉDICA
mysql -u root -p < database/schema_medical.sql
```

Este script creará:
- Tabla de productos médicos con campos específicos
- Tabla de lotes con control de vencimientos
- Tabla de categorías médicas
- Tabla de áreas/departamentos
- Tabla de alertas
- Tabla de predicciones de consumo
- Tabla de historial completo

### 2. Cargar Código al Arduino

El código Arduino es el mismo (`arduino/rfid_stock_monitor.ino`), funciona con ambos sistemas.

### 3. Instalar Dependencias del Backend

```bash
cd backend
npm install
```

### 4. Configurar Variables de Entorno

Crea un archivo `.env` en la carpeta `backend`:

```env
# Base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=rfid_stock_db

# Puerto serial
SERIAL_PORT=COM3
BAUD_RATE=9600

# Puerto del servidor
PORT=3000
```

### 5. Iniciar el Servidor Médico

```bash
cd backend
node server_medical.js
```

O en modo desarrollo:

```bash
npm run dev -- server_medical.js
```

## 🚀 Uso del Sistema Médico

### Flujo de Trabajo

1. **Configurar Categorías Médicas**
   - Crear categorías: Antibióticos, Analgésicos, Material de Curación, etc.

2. **Configurar Áreas/Departamentos**
   - Crear áreas: Urgencias, Cirugía, Pediatría, Maternidad, etc.

3. **Crear Productos Médicos**
   - Ingresar información médica completa:
     - Tipo (Medicamento/Insumo)
     - Principio activo
     - Concentración y presentación
     - Vía de administración
     - Categoría médica
     - Stock mínimo

4. **Crear Lotes**
   - Para cada producto, crear lotes con:
     - Número de lote (obligatorio)
     - Fecha de vencimiento (obligatoria)
     - Cantidad
     - Asignar RFID al lote específico

5. **Retiro de Productos**
   - Cuando Arduino detecta un RFID:
     - Sistema valida que no esté vencido
     - Solicita área/departamento de retiro
     - Decrementa stock del lote específico
     - Registra en historial con trazabilidad completa
     - Genera alertas si corresponde

6. **Monitoreo y Alertas**
   - Dashboard muestra:
     - Productos vencidos (CRÍTICO)
     - Productos por vencer (próximos 30 días)
     - Stock bajo
     - Alertas prioritarias

7. **Predicciones de Consumo**
   - Sistema analiza consumo histórico
   - Genera predicciones para:
     - Próximo mes
     - Próximo trimestre
     - Próximo año
   - Predicciones por área/departamento
   - Alertas si stock no cubre predicción

## 📊 API Endpoints Médicos

### Productos
- `GET /api/products` - Listar productos (con filtros: product_type, category_id, search, expiry_status, low_stock)
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto médico
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto
- `GET /api/products/:id/history` - Historial con filtros por área y fecha

### Lotes
- `GET /api/batches/product/:productId` - Lotes de un producto
- `GET /api/batches/:id` - Obtener lote
- `POST /api/batches` - Crear lote
- `PUT /api/batches/:id/quantity` - Actualizar cantidad

### Categorías
- `GET /api/categories` - Listar categorías
- `GET /api/categories/:id` - Obtener categoría
- `POST /api/categories` - Crear categoría

### Áreas
- `GET /api/areas` - Listar áreas activas
- `GET /api/areas/:id` - Obtener área
- `POST /api/areas` - Crear área

### Alertas
- `GET /api/alerts` - Obtener alertas activas
- `POST /api/alerts/check` - Verificar y generar alertas

### Predicciones
- `GET /api/predictions/product/:productId` - Obtener predicciones existentes
- `POST /api/predictions/product/:productId/generate` - Generar nuevas predicciones
- `GET /api/predictions/product/:productId/calculate` - Calcular predicción (preview)

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas generales
- `GET /api/dashboard/expiring` - Productos por vencer
- `GET /api/dashboard/low-stock` - Productos con stock bajo
- `GET /api/dashboard/consumption-by-area` - Consumo por área
- `GET /api/dashboard/products-by-category` - Distribución por categoría

### Retiro con Área
- `POST /api/removal/process` - Procesar retiro con área específica
  ```json
  {
    "rfid_uid": "A1B2C3D4",
    "area_id": 1
  }
  ```

## 🔒 Validaciones de Seguridad Médica

1. **Productos Vencidos**: Sistema bloquea retiro de productos vencidos
2. **Stock Insuficiente**: Valida que haya stock disponible antes de retirar
3. **FIFO (First In, First Out)**: Alerta si se intenta retirar lote más nuevo antes que el viejo
4. **Campos Obligatorios**: Número de lote y fecha de vencimiento son obligatorios
5. **Trazabilidad**: Cada movimiento queda registrado con información completa

## 📈 Sistema de Predicciones

El motor de predicciones utiliza:

1. **Promedio Móvil Simple**: Para datos básicos
2. **Promedio Móvil Ponderado**: Da más peso a datos recientes
3. **Regresión Lineal**: Para identificar tendencias a largo plazo
4. **Nivel de Confianza**: Calculado según cantidad de datos y variabilidad

**Requisitos para predicciones confiables:**
- Mínimo 7 días de datos históricos (confianza baja)
- Mínimo 30 días recomendado (confianza media-alta)
- Más datos = mayor confianza

## 🎨 Códigos de Color

- **Verde**: Stock normal y vigente
- **Amarillo**: Por vencer (30 días) o stock bajo
- **Rojo**: Vencido o stock crítico
- **Azul**: Información de predicciones

## 📝 Notas Importantes

- El sistema médico requiere que los productos tengan lotes con fechas de vencimiento
- Las alertas se generan automáticamente cada minuto
- Las predicciones se pueden generar manualmente o automáticamente
- El historial completo permite auditorías sanitarias
- Cada retiro registra el área/departamento de origen

## 🔄 Migración desde Sistema Básico

Si ya tienes el sistema básico funcionando:

1. Ejecuta `schema_medical.sql` para crear las nuevas tablas
2. Migra productos existentes a la nueva estructura
3. Crea lotes para productos existentes
4. Usa `server_medical.js` en lugar de `server.js`

## 🐛 Solución de Problemas

### Error: "Producto vencido"
- Verifica la fecha de vencimiento del lote
- Los productos vencidos no se pueden retirar automáticamente

### Error: "No hay suficientes datos para predicción"
- Necesitas al menos 7 días de consumo histórico
- Genera más movimientos de stock para mejorar predicciones

### Las alertas no aparecen
- Ejecuta manualmente: `POST /api/alerts/check`
- Verifica que los productos tengan fechas de vencimiento configuradas

---

**Sistema desarrollado para gestión médica profesional con cumplimiento normativo sanitario.**

