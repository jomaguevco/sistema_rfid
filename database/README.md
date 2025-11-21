# Base de Datos - Sistema Médico RFID

## Archivos SQL

### `schema_medical.sql` ⭐ **ARCHIVO PRINCIPAL**
**Este es el único archivo que necesitas para crear la base de datos completa.**

Contiene:
- ✅ Creación de todas las tablas del sistema médico
- ✅ Índices y relaciones
- ✅ Datos iniciales (categorías, áreas, productos de ejemplo)
- ✅ Columnas generadas virtuales corregidas (is_expired, days_to_expiry)

**Uso:**
```bash
mysql -u root -p < database/schema_medical.sql
```

---

### Archivos Obsoletos (ya incluidos en schema_medical.sql)

- `schema.sql` - Versión antigua/simple (no usar)
- `fix_batches_columns.sql` - Script de corrección (ya aplicado en schema_medical.sql)

---

## Estructura de la Base de Datos

### Tablas Principales

1. **product_categories** - Categorías médicas (Antibióticos, Analgésicos, etc.)
2. **areas** - Áreas/departamentos médicos (Urgencias, Cirugía, etc.)
3. **products** - Productos médicos con información completa
4. **product_batches** - Lotes de productos con fechas de vencimiento
5. **stock_history** - Historial completo de movimientos de stock
6. **consumption_predictions** - Predicciones de consumo por período y área
7. **stock_alerts** - Alertas automáticas del sistema

### Características Especiales

- **Columnas Generadas Virtuales**: `is_expired` y `days_to_expiry` se calculan automáticamente
- **Trazabilidad Completa**: Cada movimiento registra lote, área y fecha
- **Índices Optimizados**: Para búsquedas rápidas por RFID, vencimiento, etc.

---

## Instalación

### Primera Instalación

```bash
mysql -u root -p < database/schema_medical.sql
```

### Verificar Instalación

```bash
mysql -u root -p rfid_stock_db
```

```sql
-- Ver todas las tablas
SHOW TABLES;

-- Ver estructura de una tabla
DESCRIBE product_batches;

-- Verificar datos iniciales
SELECT COUNT(*) FROM product_categories;
SELECT COUNT(*) FROM areas;
SELECT COUNT(*) FROM products;
```

---

## Migración desde Versión Anterior

Si ya tienes una base de datos creada con el schema antiguo:

### Opción 1: Recrear Base de Datos (si no hay datos importantes)

```sql
DROP DATABASE IF EXISTS rfid_stock_db;
CREATE DATABASE rfid_stock_db;
USE rfid_stock_db;
source database/schema_medical.sql;
```

### Opción 2: Agregar Columnas Faltantes (si ya tienes datos)

```sql
USE rfid_stock_db;

-- Agregar columnas generadas si no existen
ALTER TABLE product_batches 
ADD COLUMN IF NOT EXISTS is_expired BOOLEAN GENERATED ALWAYS AS (expiry_date < CURDATE()) VIRTUAL AFTER entry_date,
ADD COLUMN IF NOT EXISTS days_to_expiry INT GENERATED ALWAYS AS (DATEDIFF(expiry_date, CURDATE())) VIRTUAL AFTER is_expired;

-- Agregar índices si no existen
ALTER TABLE product_batches 
ADD INDEX IF NOT EXISTS idx_is_expired (is_expired),
ADD INDEX IF NOT EXISTS idx_days_to_expiry (days_to_expiry);
```

---

## Notas Importantes

1. **Columnas Generadas**: Las columnas `is_expired` y `days_to_expiry` son **VIRTUAL** (no STORED) porque MySQL no permite funciones como `CURDATE()` en columnas almacenadas.

2. **INSERT IGNORE**: Los datos iniciales usan `INSERT IGNORE` para evitar errores si ya existen.

3. **Charset**: Todas las tablas usan `utf8mb4` para soportar caracteres especiales y emojis.

4. **Motor**: Todas las tablas usan `InnoDB` para soportar transacciones y claves foráneas.

---

## Resolución de Problemas

### Error: "Table already exists"
- Usa `CREATE TABLE IF NOT EXISTS` (ya incluido)
- O elimina la tabla primero: `DROP TABLE IF EXISTS nombre_tabla;`

### Error: "Column already exists"
- Usa `ADD COLUMN IF NOT EXISTS` en ALTER TABLE
- O verifica primero: `DESCRIBE nombre_tabla;`

### Error: "Foreign key constraint fails"
- Asegúrate de crear las tablas en el orden correcto (ya está en el schema)
- Verifica que las tablas referenciadas existan

---

## Documentación Adicional

- `SOLUCION_ERROR.md` - Solución al error de columnas generadas
- `schema_medical.sql` - Schema completo y unificado

