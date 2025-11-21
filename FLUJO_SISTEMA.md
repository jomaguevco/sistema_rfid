# 🔄 Flujo del Sistema - Resumen

## Flujo Principal: Retiro de Productos con RFID

```
┌─────────────┐
│   ESP32     │ Detecta tag RFID cuando se retira producto
│  (RFID)     │
└──────┬──────┘
       │ Envía: {"action":"remove","uid":"A1B2C3D4"}
       ↓
┌──────────────────┐
│  Backend Node.js │ Recibe mensaje por Serial USB
│  (Serial Handler)│
└──────┬───────────┘
       │ Emite evento Socket.IO: 'rfidDetected'
       ↓
┌──────────────────┐
│    Frontend      │ Muestra modal para seleccionar área/departamento
│   (Navegador)    │
└──────┬───────────┘
       │ Usuario selecciona área y confirma
       ↓
┌──────────────────┐
│  Backend API     │ Procesa retiro:
│  /removal/process│ • Busca producto/lote por RFID
│                  │ • Valida que no esté vencido
│                  │ • Decrementa stock (FIFO)
│                  │ • Registra en historial
└──────┬───────────┘
       │ Emite eventos Socket.IO
       ↓
┌──────────────────┐
│    Frontend      │ Actualiza automáticamente:
│   (Tiempo Real)  │ • Dashboard
│                  │ • Lista de productos
│                  │ • Alertas
│                  │ • Notificaciones
└──────────────────┘
```

## Flujo: Gestión de Productos y Lotes

```
1. CREAR PRODUCTO
   └─> Nombre, tipo, categoría, stock mínimo
   
2. CREAR LOTE
   └─> Asociar a producto
   └─> Número de lote, fecha vencimiento, cantidad
   
3. ASIGNAR RFID (Opcional)
   └─> Activar modo escucha en frontend
   └─> Acercar tag al lector ESP32
   └─> Sistema detecta y asigna automáticamente
```

## Flujo: Alertas Automáticas

```
Sistema verifica periódicamente:
├─> Stock bajo (menor a mínimo)
├─> Productos próximos a vencer
└─> Productos vencidos
    ↓
Genera alertas automáticas
    ↓
Muestra en:
├─> Dashboard
└─> Panel de alertas
```

## Componentes del Sistema

### 1. Hardware (ESP32 + RC522)
- **Función**: Detectar tags RFID
- **Comunicación**: Serial USB (115200 baud)
- **Formato**: JSON `{"action":"remove","uid":"..."}`

### 2. Backend (Node.js)
- **Función**: Procesar lógica de negocio
- **Comunicación**: 
  - Serial USB (recibe de ESP32)
  - Socket.IO (comunica con frontend)
  - REST API (endpoints HTTP)
  - MySQL (base de datos AWS RDS)

### 3. Frontend (Web)
- **Función**: Interfaz de usuario
- **Comunicación**:
  - REST API (operaciones CRUD)
  - Socket.IO (actualizaciones en tiempo real)

### 4. Base de Datos (AWS RDS)
- **Función**: Almacenar datos
- **Tablas principales**:
  - `products` - Productos médicos
  - `product_batches` - Lotes con RFID
  - `users` - Usuarios del sistema
  - `stock_history` - Historial de movimientos
  - `stock_alerts` - Alertas generadas

## Flujo de Datos Completo

```
ESP32 → Serial USB → Backend → Base de Datos
                              ↓
                         Socket.IO
                              ↓
                         Frontend → Usuario
```

## Casos de Uso

### Caso 1: Retiro Normal
1. Usuario retira producto del estante
2. ESP32 detecta tag RFID
3. Sistema solicita área de retiro
4. Usuario selecciona área
5. Stock se actualiza automáticamente

### Caso 2: Producto Vencido
1. ESP32 detecta tag RFID
2. Sistema valida fecha de vencimiento
3. **Bloquea retiro** si está vencido
4. Muestra alerta al usuario

### Caso 3: Stock Bajo
1. Sistema verifica stock periódicamente
2. Detecta que stock < mínimo
3. Genera alerta automática
4. Muestra en dashboard y panel de alertas

### Caso 4: Asignar RFID a Lote
1. Usuario crea lote en el sistema
2. Activa "Asignar RFID"
3. Acerca tag al lector ESP32
4. Sistema detecta y asigna automáticamente

## Estados del Sistema

### Inicialización
```
1. Servidor inicia
2. Conecta a base de datos AWS RDS
3. Abre puerto serial COM3
4. Inicializa Socket.IO
5. Listo para recibir conexiones
```

### Operación Normal
```
1. ESP32 escuchando tags RFID
2. Backend procesando requests
3. Frontend conectado vía Socket.IO
4. Base de datos sincronizada
```

## Validaciones Importantes

- ✅ Producto debe existir en BD
- ✅ Lote debe tener stock disponible
- ✅ Producto no debe estar vencido
- ✅ Usuario debe estar autenticado
- ✅ Área debe estar seleccionada

## Mensajes de Error Comunes

- **"Producto no encontrado"**: RFID no asignado a ningún lote
- **"Producto vencido"**: Intento de retirar producto vencido
- **"Stock insuficiente"**: Lote sin unidades disponibles
- **"Error de conexión"**: Problema con base de datos o serial

