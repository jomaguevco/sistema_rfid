# Flujo de Funcionamiento del Sistema RFID de Stock Médico

## 📋 Resumen General

Sistema de gestión de stock médico con RFID que permite:
- Control de entrada/salida de productos mediante tags RFID
- Gestión de recetas médicas con despacho por RFID
- Búsqueda inteligente de productos (RFID, código de barras, código interno, nombre)
- Manejo de cantidades para productos en cajas (múltiples unidades por paquete)

---

## 🔐 1. Autenticación y Roles

### Roles del Sistema
- **Admin**: Acceso completo a todas las funcionalidades
- **Farmacéutico**: Puede gestionar recetas, despachar, entrada/salida de stock

### Flujo de Login
1. Usuario ingresa credenciales en `/login.html`
2. Backend valida credenciales y genera token JWT
3. Token se guarda en `localStorage` como `token`
4. Usuario es redirigido a la interfaz principal

---

## 📦 2. Entrada de Stock (Ingreso de Productos)

### Flujo Completo
1. **Usuario activa modo entrada**
   - Hace clic en "Activar Escucha RFID" en la sección "Entrada Stock"
   - Se abre modal de escucha RFID

2. **Escaneo RFID**
   - Usuario acerca el tag RFID al lector RC522 (Arduino ESP32)
   - Arduino detecta el tag y envía JSON: `{"action":"entry","uid":"XXXXXX"}`
   - Backend recibe el evento y emite `rfidEntry` vía Socket.IO
   - Frontend recibe el evento y llama a `handleEntryRFID(rfidUid)`

3. **Búsqueda del producto**
   - Sistema busca producto por RFID: `GET /api/products/by-rfid/{rfidUid}`
   - Sistema busca batch por RFID: `GET /api/batches?rfid_uid={rfidUid}`

4. **Manejo de cantidad**
   - **Si es unidad individual** (`units_per_package = 1`):
     - Ingresa automáticamente 1 unidad
   - **Si es caja** (`units_per_package > 1`):
     - Muestra modal pidiendo cantidad a ingresar
     - Usuario especifica cuántas unidades ingresar
     - Confirma cantidad

5. **Procesamiento**
   - Sistema llama a `POST /api/stock/entry` con `{rfid_uid, quantity}`
   - Backend incrementa stock del batch
   - Se registra en historial

6. **Finalización**
   - Modal se cierra automáticamente
   - Se muestra notificación de éxito
   - Se recarga lista de productos

---

## 📤 3. Salida de Stock (Retiro de Productos)

### Flujo Completo
1. **Usuario activa modo salida**
   - Hace clic en "Activar Escucha RFID" en la sección "Salida Stock"
   - Se abre modal de escucha RFID

2. **Escaneo RFID**
   - Usuario acerca el tag RFID al lector
   - Arduino envía: `{"action":"remove","uid":"XXXXXX"}`
   - Backend emite `rfidExit` vía Socket.IO
   - Frontend llama a `handleExitRFID(rfidUid)`

3. **Validación de stock**
   - Sistema busca producto y batch por RFID
   - Verifica que haya stock disponible
   - Si no hay stock, muestra error

4. **Manejo de cantidad**
   - **Si es unidad individual**:
     - Retira automáticamente 1 unidad
   - **Si es caja**:
     - Muestra modal con:
       - Cantidad disponible
       - Campo para cantidad a retirar
       - Selector de área/departamento (opcional)
     - Usuario especifica cantidad y área
     - Confirma

5. **Procesamiento**
   - Sistema llama a `POST /api/stock/exit` con `{rfid_uid, quantity, area_id}`
   - Backend decrementa stock del batch
   - Verifica que no se exceda el stock disponible
   - Se registra en historial

6. **Finalización**
   - Modal se cierra automáticamente
   - Se muestra notificación de éxito
   - Se recarga lista de productos

---

## 📋 4. Gestión de Recetas

### 4.1 Crear Receta

1. **Abrir formulario**
   - Usuario hace clic en "Nueva Receta"
   - Se abre modal con formulario

2. **Completar datos**
   - Nombre del paciente (requerido)
   - DNI/ID del paciente (opcional)
   - Nombre del médico (requerido)
   - Número de colegiatura (opcional)
   - Fecha de receta (requerido)
   - Notas (opcional)

3. **Agregar medicamentos**
   - Selecciona producto del dropdown
   - Especifica cantidad requerida
   - Agrega instrucciones (opcional)
   - Hace clic en "Agregar"
   - Repite para cada medicamento

4. **Guardar receta**
   - Hace clic en "Guardar Receta"
   - Backend:
     - Genera código único: `REC-YYYY-NNNN`
     - Genera QR code con el código
     - Crea receta en BD
     - Crea items de receta
   - Se muestra QR code generado
   - Receta queda en estado "pending"

### 4.2 Buscar Receta

1. **Búsqueda por código**
   - Usuario ingresa código de receta en campo de búsqueda
   - O escanea QR code con cámara
   - Sistema busca: `GET /api/prescriptions/code/{code}`

2. **Visualización**
   - Se muestran datos de la receta
   - Se listan medicamentos requeridos
   - Cada medicamento muestra:
     - Estado: Pendiente (rojo) / Parcial (amarillo) / Completo (verde)
     - Cantidad requerida vs despachada

### 4.3 Despachar Receta (Farmacéutico)

1. **Activar modo escucha**
   - Usuario busca receta por código/QR
   - Hace clic en "Activar Escucha RFID"
   - Se activa modo de escucha

2. **Escaneo de medicamentos**
   - Usuario acerca tag RFID del medicamento al lector
   - Sistema:
     - Busca producto por RFID
     - Verifica que el producto esté en la receta
     - Verifica que no esté ya completado
     - Calcula cantidad restante requerida

3. **Manejo de cantidad**
   - **Si es unidad individual**:
     - Despacha 1 unidad (o la cantidad restante si es menor)
   - **Si es caja**:
     - Muestra prompt con:
       - Cantidad requerida
       - Ya despachado
       - Faltan
     - Usuario especifica cantidad a despachar
     - Sistema valida que no exceda lo requerido

4. **Procesamiento**
   - Sistema busca batch por RFID
   - Verifica stock disponible
   - Llama a `PUT /api/prescriptions/{id}/fulfill` con:
     - `prescription_item_id`
     - `batch_id`
     - `quantity`
   - Backend:
     - Incrementa `quantity_dispensed` del item
     - Decrementa stock del batch
     - Registra en `prescription_fulfillments`
     - Actualiza estado de receta (pending/partial/fulfilled)

5. **Actualización visual**
   - Items despachados se muestran en verde
   - Items pendientes se muestran en rojo
   - Si todos los items están completos, receta pasa a "fulfilled"

---

## 🔍 5. Búsqueda de Productos

### Búsqueda Unificada
El sistema permite buscar productos de múltiples formas:

1. **Por RFID**
   - Usuario activa modo escucha RFID
   - Escanea tag RFID
   - Sistema busca automáticamente

2. **Por código de barras**
   - Usuario ingresa código de barras en campo de búsqueda
   - Sistema busca: `GET /api/products/by-barcode/{barcode}`

3. **Por código interno**
   - Usuario ingresa código interno
   - Sistema busca en campo `internal_code`

4. **Por nombre**
   - Usuario ingresa nombre o parte del nombre
   - Sistema busca en campo `name`

### Endpoint Unificado
- `GET /api/products/search?q={query}`
- Busca en todos los campos: RFID, barcode, internal_code, name
- Retorna lista de productos coincidentes

---

## 🔄 6. Flujo de Datos (Arquitectura)

### Componentes
1. **Arduino ESP32 + RC522**
   - Lee tags RFID
   - Envía JSON por Serial: `{"action":"entry/remove","uid":"XXXXXX"}`
   - Puerto: COM3 (configurable en `.env`)

2. **Backend Node.js (Express + Socket.IO)**
   - `serialHandler_medical.js`: Lee Serial, emite eventos Socket.IO
   - `server_medical.js`: Servidor Express, rutas API, Socket.IO
   - `database_medical.js`: Funciones de BD MySQL (AWS RDS)
   - Rutas API: `/api/products`, `/api/batches`, `/api/prescriptions`, `/api/stock`

3. **Frontend (HTML/JS + React)**
   - **Sistema actual**: HTML/JS vanilla con Socket.IO client
   - **Sistema nuevo**: React con hooks personalizados (`useRFID`)
   - Ambos sistemas funcionan en paralelo

### Flujo de Eventos RFID
```
Arduino → Serial → serialHandler → Socket.IO → Frontend → handleEntryRFID/handleExitRFID
```

---

## 📊 7. Base de Datos

### Tablas Principales
- **products**: Productos (medicamentos/insumos)
- **product_batches**: Lotes con RFID, cantidad, fecha vencimiento
- **prescriptions**: Recetas médicas
- **prescription_items**: Items de receta (medicamentos requeridos)
- **prescription_fulfillments**: Registro de despachos
- **stock_history**: Historial de movimientos
- **users**: Usuarios del sistema
- **areas**: Áreas/departamentos

### Relaciones Clave
- `product_batches.rfid_uid` → Identifica lote por RFID
- `products.units_per_package` → Define si es caja (1 = unidad, >1 = caja)
- `prescription_items.quantity_dispensed` → Rastrea cuánto se ha despachado

---

## ⚙️ 8. Configuración

### Variables de Entorno (`.env`)
```
PORT=3000
DB_HOST=recetariowebqr.c38qyu046ryr.us-east-2.rds.amazonaws.com
DB_USER=admin
DB_PASS=J0nxtxn13052003_
DB_NAME=rfid_stock_db
JWT_SECRET=supersecreto_2025
SERIAL_PORT=COM3
BAUD_RATE=115200
```

### Inicio del Sistema
1. Iniciar servidor backend: `node backend/server_medical.js`
2. Subir código Arduino a ESP32
3. Abrir frontend: `http://localhost:3000` (HTML) o `http://localhost:5173` (React)

---

## ✅ 9. Validaciones y Seguridad

### Validaciones Implementadas
- ✅ Verificación de stock antes de retirar
- ✅ Verificación de cantidad requerida en recetas
- ✅ Validación de que producto esté en receta antes de despachar
- ✅ Verificación de que item no esté ya completado
- ✅ Autenticación JWT en todas las rutas API
- ✅ Roles y permisos (Admin vs Farmacéutico)

### Manejo de Errores
- Errores de conexión a BD
- Errores de stock insuficiente
- Errores de RFID no encontrado
- Errores de autenticación
- Todos los errores se muestran al usuario con mensajes claros

---

## 🎯 10. Casos de Uso Típicos

### Caso 1: Ingreso de nueva mercancía
1. Farmacéutico recibe caja de medicamentos
2. Activa modo entrada RFID
3. Escanea tag RFID de la caja
4. Sistema detecta que es caja (ej: 10 unidades)
5. Pregunta cuántas unidades ingresar
6. Ingresa cantidad (ej: 10)
7. Stock se incrementa

### Caso 2: Retiro para área
1. Enfermera necesita medicamento
2. Farmacéutico activa modo salida RFID
3. Escanea tag RFID
4. Sistema detecta que es caja
5. Pregunta cantidad y área
6. Retira cantidad especificada
7. Stock se decrementa

### Caso 3: Despacho de receta
1. Paciente trae receta médica
2. Farmacéutico busca receta por código/QR
3. Activa modo escucha RFID
4. Escanea cada medicamento de la receta
5. Sistema valida y despacha
6. Items se marcan en verde cuando están completos
7. Cuando todos están completos, receta queda "fulfilled"

---

## 📝 Notas Importantes

- **RFID UID**: Se normaliza a mayúsculas y se recorta espacios
- **Cantidades**: Siempre se valida que no exceda stock disponible
- **Modales**: Se cierran automáticamente después de operaciones exitosas
- **Recarga**: Listas se recargan automáticamente después de cambios
- **Socket.IO**: Mantiene conexión en tiempo real para eventos RFID
- **Serial**: Puerto Serial se abre al iniciar servidor backend

---

## 🔧 Troubleshooting

### RFID no se detecta
- Verificar que Arduino esté conectado y funcionando
- Verificar puerto Serial en `.env`
- Verificar que tag RFID esté asignado a un batch en BD

### Producto no encontrado
- Verificar que el RFID esté asignado a un batch
- Verificar que el batch tenga un producto asociado

### Stock insuficiente
- Verificar cantidad disponible en el batch
- Verificar que no se intente retirar más de lo disponible

### Receta no se encuentra
- Verificar que el código de receta sea correcto
- Verificar que la receta exista en BD

---

**Última actualización**: Noviembre 2025
**Versión del sistema**: 1.0.0

