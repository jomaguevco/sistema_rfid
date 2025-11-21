# Cómo Ver los Medicamentos en la Interfaz

## 📍 Dónde Ver los Medicamentos

### 1. **Catálogo de Medicamentos** (Solo Administradores)
- **URL**: http://localhost:5173/products
- **Ruta del menú**: "Medicamentos" (solo visible para administradores)
- **Qué muestra**: Tabla con todos los productos y sus atributos (nombre, principio activo, concentración, presentación, tipo, categoría)
- **Función**: Ver y gestionar el catálogo de productos

### 2. **Módulo de Stock** (Administradores y Químicos)
- **URL**: http://localhost:5173/stock
- **Ruta del menú**: "Stock"
- **Qué muestra**: 
  - Productos agrupados por **RFID**
  - Columna "Stock" con la cantidad total
  - Botón **"Stock"** en cada fila para ver los lotes detallados

### 3. **Modal de Detalle de Stock**
Cuando haces clic en el botón **"Stock"** de cualquier producto:
- **Se abre un modal** que muestra **TODOS los lotes** con ese RFID
- **Cada fila** representa un lote diferente con:
  - Código RFID (el mismo para todas las filas)
  - Nombre del Medicamento
  - **Número de Lote** (diferente para cada fila)
  - **Fecha de Vencimiento** (diferente para cada fila)
  - **Cantidad** (diferente para cada fila)
  - Estado (Vencido/Próximo a vencer/Válido)

## 🎯 Ejemplo Visual

```
Página Stock (http://localhost:5173/stock)
┌─────────────────────────────────────────────────────────┐
│ Paracetamol 500mg | RFID: 2090077 | Stock: 225 [Stock] │
└─────────────────────────────────────────────────────────┘
                              ↓ (clic en "Stock")
┌─────────────────────────────────────────────────────────┐
│        Modal: Detalle de Stock - RFID: 2090077         │
├─────────────────────────────────────────────────────────┤
│ Total de Lotes: 3 | Stock Total: 225 | Lotes Válidos: 3│
├─────────────────────────────────────────────────────────┤
│ RFID      | Lote          | Cantidad | F. Vencimiento  │
├─────────────────────────────────────────────────────────┤
│ 2090077   | LOT-2025-001  | 50       | 2026-01-15      │ ← Fila 1
│ 2090077   | LOT-2025-002  | 75       | 2026-06-20      │ ← Fila 2
│ 2090077   | LOT-2025-003  | 100      | 2027-01-10      │ ← Fila 3
└─────────────────────────────────────────────────────────┘
```

## 📦 Productos Insertados

### Medicamentos Iniciales (RFID: 2090074 - 2090085)
1. Amoxicilina 500mg - RFID: `2090074`
2. Cefalexina 500mg - RFID: `2090075`
3. Azitromicina 250mg - RFID: `2090076`
4. Paracetamol 500mg - RFID: `2090077`
5. Ibuprofeno 400mg - RFID: `2090078`
6. Diclofenaco 50mg - RFID: `2090079`
7. Jarabe de Amoxicilina - RFID: `2090080`
8. Gotas Nasales - RFID: `2090081`
9. Gasas Estériles - RFID: `2090082`
10. Algodón Estéril - RFID: `2090083`
11. Vendas Elásticas - RFID: `2090084`
12. Jeringas Desechables - RFID: `2090085`

### Medicamentos Adicionales (RFID: 2090086 - 2090112)

#### Antibióticos:
- Eritromicina 500mg - RFID: `2090086`
- Doxiciclina 100mg - RFID: `2090087`
- Ciprofloxacino 500mg - RFID: `2090088`

#### Analgésicos:
- Tramadol 50mg - RFID: `2090089`
- Naproxeno 500mg - RFID: `2090090`
- Ketorolaco 10mg - RFID: `2090091`

#### Antinflamatorios:
- Meloxicam 15mg - RFID: `2090092`
- Celecoxib 200mg - RFID: `2090093`

#### Sistema Respiratorio:
- Salbutamol Inhalador - RFID: `2090094`
- Jarabe para la Tos - RFID: `2090095`

#### Gastrointestinales:
- Omeprazol 20mg - RFID: `2090096`
- Lansoprazol 30mg - RFID: `2090097`
- Dimenhidrinato 50mg - RFID: `2090098`

#### Tópicos:
- Pomada Antibiótica - RFID: `2090099`
- Crema Antifúngica - RFID: `2090100`

#### Insumos:
- Agujas Estériles - RFID: `2090101`
- Guantes de Látex - RFID: `2090102`
- Vendas de Yeso - RFID: `2090103`
- Mascarillas Quirúrgicas - RFID: `2090104`
- Solución Salina 0.9% - RFID: `2090105`
- Alcohol Medicinal 70% - RFID: `2090106`
- Algodón Hidrófilo - RFID: `2090107`
- Esparadrapo - RFID: `2090108`

#### Diabetes:
- Metformina 500mg - RFID: `2090109`
- Glibenclamida 5mg - RFID: `2090110`

#### Antihistamínicos:
- Loratadina 10mg - RFID: `2090111`
- Cetirizina 10mg - RFID: `2090112`

## 🔧 Cómo Insertar los Medicamentos

### Opción 1: Script SQL (Recomendado si MySQL está corriendo)
```bash
mysql -u root -p rfid_stock_db < database/insert_more_medications.sql
```

### Opción 2: Script Node.js (Requiere que MySQL esté corriendo)
```bash
node backend/scripts/insert_more_medications.js
```

### Opción 3: Manualmente desde la Interfaz
1. Ve a http://localhost:5173/products (como administrador)
2. Haz clic en "Agregar Producto"
3. Completa el formulario
4. Guarda el producto
5. Ve a http://localhost:5173/stock
6. Busca el producto y haz clic en "Stock"
7. Haz clic en "Agregar Lote" y completa la información

## ⚠️ Nota Importante

Para que los múltiples lotes con el mismo RFID funcionen correctamente, primero debes eliminar la restricción UNIQUE en `rfid_uid`:

```sql
USE rfid_stock_db;
ALTER TABLE product_batches DROP INDEX rfid_uid;
CREATE INDEX idx_rfid_uid ON product_batches(rfid_uid);
```

O ejecuta: `database/fix_rfid_constraint.sql`

## ✅ Verificación

Para verificar que los medicamentos se insertaron correctamente:

```sql
SELECT 
    p.name,
    p.rfid_uid,
    COUNT(pb.id) as num_lotes,
    SUM(pb.quantity) as stock_total
FROM products p
LEFT JOIN product_batches pb ON pb.product_id = p.id
GROUP BY p.id, p.name, p.rfid_uid
HAVING COUNT(pb.id) > 1
ORDER BY num_lotes DESC;
```

Esto mostrará todos los productos que tienen múltiples lotes con el mismo RFID.

