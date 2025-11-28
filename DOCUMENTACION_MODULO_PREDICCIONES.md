# Documentación Completa del Módulo de Predicciones

## Tabla de Contenidos
1. [Introducción General](#introducción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes Frontend](#componentes-frontend)
4. [Motor de Predicción (Backend)](#motor-de-predicción-backend)
5. [Algoritmos de Predicción](#algoritmos-de-predicción)
6. [Cálculo de Confianza](#cálculo-de-confianza)
7. [Ajustes y Factores Externos](#ajustes-y-factores-externos)
8. [Tabla de Predicciones](#tabla-de-predicciones)
9. [Modal de Detalles](#modal-de-detalles)
10. [Flujo Completo de Datos](#flujo-completo-de-datos)

---

## Introducción General

El módulo de predicciones es un sistema completo que utiliza datos históricos de consumo para predecir la demanda futura de productos médicos. El sistema implementa múltiples algoritmos estadísticos y matemáticos para generar predicciones precisas con diferentes niveles de confianza.

### Objetivos del Sistema
- Predecir el consumo futuro de productos médicos
- Calcular el stock necesario para cubrir la demanda
- Identificar productos con déficit de stock
- Proporcionar recomendaciones de pedidos
- Ofrecer transparencia total en los cálculos realizados

---

## Arquitectura del Sistema

### Estructura de Archivos

```
backend/
├── utils/
│   └── predictionEngine.js    # Motor principal de predicciones
├── routes/
│   └── predictions.js         # Endpoints API REST
└── database_medical.js        # Acceso a base de datos

frontend/
└── react/src/components/predictions/
    ├── PredictionsTable.jsx    # Tabla principal de predicciones
    └── PredictionDetailModal.jsx  # Modal con detalles completos
```

### Flujo de Datos

1. **Frontend** solicita predicciones → `GET /api/predictions/product/:productId`
2. **Backend** obtiene datos históricos de `stock_history`
3. **Motor de Predicción** calcula usando algoritmos seleccionados
4. **Backend** aplica ajustes y calcula confianza
5. **Frontend** muestra resultados en tabla y modal detallado

---

## Componentes Frontend

### 1. PredictionsTable.jsx

**Ubicación:** `frontend/react/src/components/predictions/PredictionsTable.jsx`

**Propósito:** Muestra una tabla completa con todas las predicciones de productos, permitiendo ordenar, filtrar y ver detalles.

#### Columnas de la Tabla

##### 1.1. Columna "Producto"
- **Campo:** `product_name`
- **Origen:** Base de datos `products.name`
- **Función:** Muestra el nombre del producto médico
- **Ordenamiento:** Alfabético (A-Z o Z-A)
- **Renderizado:** Texto en negrita

##### 1.2. Columna "Predicción"
- **Campo:** `predicted_quantity`
- **Origen:** `consumption_predictions.predicted_quantity`
- **Función:** Muestra la cantidad predicha de consumo para el período seleccionado
- **Cálculo:** Resultado del algoritmo de predicción multiplicado por días del período
- **Formato:** Badge azul con número formateado (ej: "7,692 unidades")
- **Ordenamiento:** Numérico (ascendente/descendente)

##### 1.3. Columna "Stock Actual"
- **Campo:** `current_stock`
- **Origen:** Suma de `product_batches.quantity` para el producto
- **Función:** Muestra el stock disponible actualmente
- **Cálculo SQL:**
  ```sql
  SELECT SUM(pb.quantity) 
  FROM product_batches pb 
  WHERE pb.product_id = ?
  ```
- **Formato:** Badge verde si hay stock, rojo si es 0
- **Ordenamiento:** Numérico

##### 1.4. Columna "% Cobertura"
- **Campo:** `coverage_percent` (calculado en frontend)
- **Función:** Indica qué porcentaje de la predicción está cubierto por el stock actual
- **Fórmula:** `(Stock Actual / Predicción) × 100`
- **Interpretación:**
  - **≥ 100%:** Stock suficiente o excedente (verde)
  - **80-99%:** Cobertura buena pero ajustada (amarillo)
  - **50-79%:** Cobertura insuficiente (amarillo)
  - **< 50%:** Cobertura crítica (rojo)
- **Ordenamiento:** Numérico

##### 1.5. Columna "Déficit"
- **Campo:** `deficit` (calculado en frontend)
- **Función:** Muestra cuántas unidades faltan para cubrir la predicción
- **Fórmula:** `max(0, Predicción - Stock Actual)`
- **Formato:**
  - Si déficit ≤ 0: Badge verde "Suficiente"
  - Si déficit > 0: Badge rojo con cantidad faltante
- **Ordenamiento:** Numérico (por defecto descendente)

##### 1.6. Columna "Stock Recomendado"
- **Campo:** `recommended_stock` (calculado en frontend)
- **Función:** Indica el stock ideal que debería tener el producto
- **Fórmula:** `Predicción × 1.2` (predicción + 20% de margen de seguridad)
- **Formato:** Badge con cantidad + indicador si necesita más stock
- **Lógica:** Si `Stock Recomendado > Stock Actual`, muestra "+X necesarias"
- **Ordenamiento:** Numérico

##### 1.7. Columna "Tendencia"
- **Campo:** `trend` (calculado en frontend)
- **Función:** Indica la tendencia de consumo comparada con el período anterior
- **Cálculo:**
  ```javascript
  if (deficit > predicted * 0.3) trend = 'increasing'  // Tendencia al alza
  else if (deficit < predicted * 0.1 && current > predicted) trend = 'decreasing'  // Tendencia a la baja
  else trend = 'stable'  // Tendencia estable
  ```
- **Valores:**
  - `increasing`: Badge rojo "Aumentando" (↑)
  - `decreasing`: Badge verde "Disminuyendo" (↓)
  - `stable`: Badge azul "Estable" (→)
- **Ordenamiento:** Alfabético

##### 1.8. Columna "Confianza"
- **Campo:** `confidence_level`
- **Origen:** `consumption_predictions.confidence_level`
- **Función:** Muestra el nivel de confianza de la predicción (0-100%)
- **Visualización:** Barra de progreso + Badge con porcentaje
- **Colores:**
  - **≥ 80%:** Verde (alta confianza)
  - **50-79%:** Amarillo (confianza media)
  - **< 50%:** Rojo (baja confianza)
- **Ordenamiento:** Numérico

##### 1.9. Columna "Última Actualización"
- **Campo:** `calculation_date`
- **Origen:** `consumption_predictions.calculation_date`
- **Función:** Muestra cuándo se calculó la predicción
- **Formato:** Fecha en formato español (ej: "27 nov 2025")
- **Ordenamiento:** Por fecha

##### 1.10. Columna "Acciones"
- **Funciones:**
  - **"Detalles":** Abre el modal con análisis completo
  - **"Regenerar":** Recalcula la predicción con datos actualizados (requiere permiso)

#### Funcionalidades Adicionales

- **Búsqueda:** Filtra productos por nombre
- **Ordenamiento:** Click en encabezado para ordenar por cualquier columna
- **Filtrado:** Solo muestra predicciones del período seleccionado (mes/trimestre/año)

---

## Motor de Predicción (Backend)

### Archivo: `backend/utils/predictionEngine.js`

### Función Principal: `predictConsumption(productId, period, areaId)`

Esta función es el corazón del sistema de predicciones. Realiza los siguientes pasos:

#### Paso 1: Obtener Datos Históricos

**Función:** `getHistoricalConsumption(productId, areaId, days)`

**Qué hace:**
1. Consulta la tabla `stock_history` para obtener registros de consumo
2. Filtra por `action = 'remove'` (solo retiros de stock)
3. Agrupa consumo por día
4. Rellena días sin datos con 0 para crear serie temporal continua
5. Retorna array de valores diarios ordenados cronológicamente

**Query SQL:**
```sql
SELECT * FROM stock_history 
WHERE product_id = ? 
  AND action = 'remove'
  AND consumption_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
ORDER BY consumption_date ASC
```

**Cálculo de Consumo Diario:**
```javascript
consumed = previous_stock - new_stock
```

**Resultado:**
```javascript
{
  values: [5, 10, 8, 12, ...],  // Array de consumo diario
  dates: ['2025-10-01', '2025-10-02', ...],
  period: {
    start: '2025-10-01',
    end: '2025-11-28',
    days_with_data: 45,
    days_total: 90
  }
}
```

#### Paso 2: Validación de Datos

**Requisito Mínimo:** 7 días de datos históricos

**Si hay menos de 7 días:**
- Retorna predicción = 0
- Confianza = 0%
- Mensaje: "No hay suficientes datos históricos"

#### Paso 3: Cálculo de Estadísticas Descriptivas

**Función:** `calculateStatistics(data)`

**Qué calcula:**

1. **Media (Promedio):**
   - Fórmula: `μ = Σx / n`
   - Ejemplo: `(5+10+8+12) / 4 = 8.75`

2. **Desviación Estándar:**
   - Fórmula: `σ = √(Σ(x - μ)² / n)`
   - Mide la variabilidad del consumo
   - Valores altos = consumo muy variable

3. **Coeficiente de Variación:**
   - Fórmula: `CV = (σ / μ) × 100`
   - Mide variabilidad relativa
   - **CV < 30%:** Consumo estable
   - **CV 30-50%:** Variabilidad moderada
   - **CV > 50%:** Alta variabilidad

4. **Rango:**
   - Mínimo: Valor más bajo de consumo diario
   - Máximo: Valor más alto de consumo diario

**Resultado:**
```javascript
{
  mean: 8.75,
  std_deviation: 2.5,
  coefficient_of_variation: 28.57,
  min: 5,
  max: 12,
  median: 9
}
```

#### Paso 4: Selección del Algoritmo

El sistema selecciona automáticamente el mejor algoritmo según la cantidad de datos:

- **30+ días:** Promedio Móvil Exponencial (EMA) - Más preciso
- **14-29 días:** Promedio Móvil Ponderado - Buen balance
- **7-13 días:** Promedio Móvil Simple - Básico pero funcional

---

## Algoritmos de Predicción

### 1. Promedio Móvil Simple (Simple Moving Average)

**Cuándo se usa:** 7-13 días de datos históricos

**Fórmula:**
```
MA = (x₁ + x₂ + ... + xₙ) / n
```

**Ejemplo:**
- Últimos 7 días: [5, 10, 8, 12, 9, 11, 7]
- Suma: 62
- Promedio: 62 / 7 = 8.86 unidades/día
- Predicción 30 días: 8.86 × 30 = 265.8 unidades

**Ventajas:**
- Simple y fácil de entender
- Funciona con pocos datos

**Desventajas:**
- Trata todos los días igual (no da más peso a datos recientes)
- Puede ser lento para capturar tendencias

**Implementación:**
```javascript
function calculateMovingAverage(data, period) {
  const recentData = data.slice(-period);
  const sum = recentData.reduce((acc, val) => acc + val, 0);
  return sum / period;
}
```

### 2. Promedio Móvil Ponderado (Weighted Moving Average)

**Cuándo se usa:** 14-29 días de datos históricos

**Fórmula:**
```
WMA = Σ(valor × peso) / Σ(peso)
```

**Asignación de Pesos:**
- Día más antiguo: peso 1
- Día siguiente: peso 2
- ...
- Día más reciente: peso n (máximo)

**Ejemplo:**
- Últimos 5 días: [5, 10, 8, 12, 9]
- Pesos: [1, 2, 3, 4, 5]
- Cálculo:
  - 5 × 1 = 5
  - 10 × 2 = 20
  - 8 × 3 = 24
  - 12 × 4 = 48
  - 9 × 5 = 45
  - Suma ponderada: 142
  - Suma de pesos: 15
  - WMA: 142 / 15 = 9.47 unidades/día

**Ventajas:**
- Da más importancia a datos recientes
- Mejor para capturar tendencias a corto plazo

**Desventajas:**
- Requiere más datos que el promedio simple

**Implementación:**
```javascript
function calculateWeightedMovingAverage(data, period) {
  const recentData = data.slice(-period);
  let weightedSum = 0;
  let weightSum = 0;
  
  recentData.forEach((value, index) => {
    const weight = index + 1;  // Peso aumenta con la posición
    weightedSum += value * weight;
    weightSum += weight;
  });
  
  return weightedSum / weightSum;
}
```

### 3. Promedio Móvil Exponencial (EMA - Exponential Moving Average)

**Cuándo se usa:** 30+ días de datos históricos

**Fórmula:**
```
EMA_today = (Valor_today × α) + (EMA_yesterday × (1 - α))
```

**Parámetros:**
- **α (alpha):** Factor de suavizado = 0.2 (20% peso al valor actual, 80% al EMA anterior)
- **EMA inicial:** Promedio simple de los primeros N días

**Ejemplo:**
- Datos: [5, 10, 8, 12, 9, 11, 7, ...]
- EMA inicial (primeros 7 días): 8.86
- Día 8 (valor = 13):
  - EMA = (13 × 0.2) + (8.86 × 0.8) = 2.6 + 7.09 = 9.69
- Día 9 (valor = 10):
  - EMA = (10 × 0.2) + (9.69 × 0.8) = 2.0 + 7.75 = 9.75
- ... (continúa recursivamente)

**Ventajas:**
- Excelente para capturar tendencias
- Responde rápidamente a cambios recientes
- Suaviza datos ruidosos

**Desventajas:**
- Más complejo de calcular
- Requiere más datos históricos

**Implementación:**
```javascript
function calculateExponentialMovingAverage(data, period, alpha = 0.2) {
  // EMA inicial = promedio simple de primeros N días
  const initialData = data.slice(0, period);
  let ema = initialData.reduce((sum, val) => sum + val, 0) / period;
  
  // Aplicar fórmula EMA recursivamente
  for (let i = period; i < data.length; i++) {
    ema = (alpha * data[i]) + ((1 - alpha) * ema);
  }
  
  return ema;
}
```

### 4. Regresión Lineal (Solo para predicciones anuales)

**Cuándo se usa:** 30+ días de datos Y período = 'year'

**Fórmula:**
```
y = mx + b
```

Donde:
- **m (pendiente):** Tasa de cambio diaria
- **b (intercepto):** Valor base
- **x:** Día del período (1, 2, 3, ...)

**Cálculo de Pendiente:**
```
m = (n×Σxy - Σx×Σy) / (n×Σx² - (Σx)²)
```

**Cálculo de Intercepto:**
```
b = (Σy - m×Σx) / n
```

**Ejemplo:**
- Datos: [5, 10, 8, 12, 9, 11, 7]
- Días (x): [1, 2, 3, 4, 5, 6, 7]
- Cálculos:
  - Σx = 28
  - Σy = 62
  - Σxy = 1×5 + 2×10 + ... = 245
  - Σx² = 1² + 2² + ... = 140
  - m = (7×245 - 28×62) / (7×140 - 28²) = 0.5
  - b = (62 - 0.5×28) / 7 = 6.86
- Ecuación: y = 0.5x + 6.86
- Predicción día 365: y = 0.5×365 + 6.86 = 189.36 unidades

**Combinación con EMA:**
Para predicciones anuales, se combina:
- 70% del resultado de EMA
- 30% del resultado de regresión lineal

**Fórmula combinada:**
```
Predicción Final = (EMA × 0.7) + (Regresión × 0.3)
```

---

## Cálculo de Confianza

**Función:** `calculateConfidenceLevel(data, predictedValue)`

### Factores que Afectan la Confianza

#### Factor 1: Cantidad de Datos Históricos

| Días de Datos | Confianza Base | Impacto |
|---------------|----------------|---------|
| < 7 días | 30% | -70% |
| 7-29 días | 50% | -50% |
| 30+ días | 100% | 0% (sin penalización) |

**Lógica:**
```javascript
if (data.length < 7) {
  confidence = 30;  // Muy baja confianza
} else if (data.length < 30) {
  confidence = 50;  // Confianza media
} else {
  confidence = 100;  // Base sólida
}
```

#### Factor 2: Variabilidad del Consumo (Coeficiente de Variación)

**Solo se aplica si hay ≥ 7 días de datos**

| CV | Impacto | Razón |
|----|--------|-------|
| < 30% | 0% (sin penalización) | Consumo estable |
| 30-50% | -25% | Variabilidad moderada |
| > 50% | -40% | Alta variabilidad |

**Ejemplo:**
- Media: 10 unidades/día
- Desviación estándar: 6 unidades
- CV = (6/10) × 100 = 60%
- Como CV > 50%, se reduce confianza en 40%

#### Factor 3: Período de Predicción

| Período | Ajuste | Razón |
|---------|--------|-------|
| Mes (30 días) | 0% | Corto plazo, menor incertidumbre |
| Trimestre (90 días) | -10% | Mediano plazo, incertidumbre moderada |
| Año (365 días) | -20% | Largo plazo, mayor incertidumbre |

**Lógica:**
```javascript
if (period === 'year') {
  confidence -= 20;  // Mayor incertidumbre a largo plazo
} else if (period === 'quarter') {
  confidence -= 10;  // Incertidumbre moderada
}
```

#### Factor 4: Volatilidad del Escenario Externo

**Solo si se detecta alta volatilidad en tendencia histórica**

| Volatilidad | Impacto | Razón |
|-------------|---------|-------|
| Baja | 0% | Tendencia estable |
| Media | 0% | Variación normal |
| Alta | -15% | Cambios bruscos detectados |

### Cálculo Final de Confianza

**Fórmula:**
```
Confianza Final = Confianza Base 
                 - Penalización por Datos
                 - Penalización por Variabilidad
                 - Penalización por Período
                 - Penalización por Volatilidad
```

**Límites:**
- Mínimo: 20% (nunca menos)
- Máximo: 100%

**Ejemplo Completo:**

1. **Datos:** 45 días históricos → Confianza base: 100%
2. **CV:** 35% → Penalización: -25% → Confianza: 75%
3. **Período:** Año → Penalización: -20% → Confianza: 55%
4. **Volatilidad:** Alta → Penalización: -15% → Confianza: 40%
5. **Resultado Final:** 40% (dentro del rango válido)

**Código:**
```javascript
let confidence = 100;

// Factor 1: Cantidad de datos
if (data.length < 7) {
  confidence = 30;
} else if (data.length < 30) {
  confidence = 50;
}

// Factor 2: Variabilidad
if (data.length >= 7) {
  if (cv > 50) {
    confidence = Math.min(confidence, 60);  // Máximo 60% si CV alto
  } else if (cv > 30) {
    confidence = Math.min(confidence, 75);  // Máximo 75% si CV medio
  }
}

// Factor 3: Período
if (period === 'year') {
  confidence = Math.max(confidence - 20, 30);
} else if (period === 'quarter') {
  confidence = Math.max(confidence - 10, 40);
}

// Factor 4: Volatilidad
if (volatility === 'high') {
  confidence = Math.max(confidence - 15, 20);
}

return Math.round(confidence);
```

---

## Ajustes y Factores Externos

### Función: `applyAdjustments(baseQuantity, productId, period, historicalData)`

Esta función aplica ajustes a la predicción base para considerar factores externos.

### Ajuste 1: Estacionalidad

**Función:** `getSeasonalityFactor(period, productId)`

**Qué hace:**
- Aplica un factor de estacionalidad basado en el mes actual
- Usa función sinusoidal para variación suave
- Ajusta según el período de predicción

**Fórmula Base:**
```
Factor = 1 + sin((mes + id_producto) × 0.3) × 0.05
```

**Ajustes por Período:**
- **Mes:** Factor base (sin ajuste adicional)
- **Trimestre:** Factor + 0.04
- **Año:** Factor + 0.07

**Ejemplo:**
- Mes actual: Noviembre (mes 11)
- ID Producto: 5
- Cálculo: 1 + sin((11 + 5) × 0.3) × 0.05 = 1.02
- Para trimestre: 1.02 + 0.04 = 1.06
- Para año: 1.02 + 0.07 = 1.09

**Aplicación:**
```javascript
afterSeasonality = baseQuantity × seasonalityFactor
```

### Ajuste 2: Tendencia Histórica Real

**Función:** `getExternalScenario(historicalData, period)`

**Qué hace:**
- Compara los últimos 30 días con los 30 días anteriores
- Calcula cambio porcentual real
- Aplica ajuste moderado basado en tendencia detectada

**Cálculo:**
```javascript
// Promedio últimos 30 días
recentAvg = promedio(últimos 30 días)

// Promedio 30 días anteriores
previousAvg = promedio(días 31-60)

// Cambio porcentual
changePercent = ((recentAvg - previousAvg) / previousAvg) × 100

// Multiplicador de demanda (limitado entre 0.9 y 1.1)
demandMultiplier = max(0.9, min(1.1, 1 + (changePercent / 1000)))

// Demanda extra (ajuste suave)
extraDemand = round(changePercent × 0.5)
```

**Ejemplo:**
- Últimos 30 días: promedio 12 unidades/día
- 30 días anteriores: promedio 10 unidades/día
- Cambio: ((12-10)/10) × 100 = +20%
- Multiplicador: 1 + (20/1000) = 1.02
- Demanda extra: 20 × 0.5 = 10 unidades

**Aplicación:**
```javascript
afterMultiplier = afterSeasonality × demandMultiplier
finalPrediction = afterMultiplier + extraDemand
```

**Si no hay suficientes datos (< 30 días):**
- No se aplican ajustes externos
- `demandMultiplier = 1.0`
- `extraDemand = 0`

### Pasos de Ajuste Completos

**Paso 1: Aplicar Estacionalidad**
```
Predicción después de estacionalidad = Predicción Base × Factor Estacional
```

**Paso 2: Aplicar Tendencia Histórica**
```
Predicción después de tendencia = Predicción Estacional × Multiplicador Tendencia
```

**Paso 3: Agregar Demanda Extra**
```
Predicción Final = Predicción Tendencia + Demanda Extra
```

**Ejemplo Completo:**
1. Predicción base (EMA): 300 unidades
2. Factor estacional: 1.06
   - Después de estacionalidad: 300 × 1.06 = 318 unidades
3. Multiplicador tendencia: 1.02
   - Después de tendencia: 318 × 1.02 = 324.36 unidades
4. Demanda extra: 10 unidades
   - Predicción final: 324.36 + 10 = 334.36 → **335 unidades** (redondeado)

---

## Tabla de Predicciones

### Componente: PredictionsTable.jsx

### Cálculos en Frontend

#### 1. Stock Recomendado
```javascript
recommendedStock = Math.round(predictedQuantity * 1.2)
```
- **Fórmula:** Predicción × 1.2 (agrega 20% de margen de seguridad)
- **Propósito:** Stock ideal para cubrir variaciones inesperadas

#### 2. Porcentaje de Cobertura
```javascript
coveragePercent = predicted > 0 
  ? Math.round((current / predicted) * 100)
  : (current > 0 ? 100 : 0)
```
- **Fórmula:** (Stock Actual / Predicción) × 100
- **Interpretación:**
  - 100%+ = Stock suficiente
  - 80-99% = Cobertura buena
  - 50-79% = Cobertura insuficiente
  - < 50% = Cobertura crítica

#### 3. Déficit
```javascript
deficit = Math.max(0, predictedQuantity - currentStock)
```
- **Fórmula:** max(0, Predicción - Stock Actual)
- **Resultado:** Cantidad faltante (0 si hay suficiente stock)

#### 4. Tendencia
```javascript
if (deficit > predicted * 0.3) {
  trend = 'increasing'  // Déficit > 30% de predicción
} else if (deficit < predicted * 0.1 && current > predicted) {
  trend = 'decreasing'  // Déficit < 10% y hay excedente
} else {
  trend = 'stable'  // Situación equilibrada
}
```

### Funcionalidades de la Tabla

#### Búsqueda
- Filtra productos por nombre en tiempo real
- Búsqueda case-insensitive

#### Ordenamiento
- Click en encabezado de columna para ordenar
- Alterna entre ascendente/descendente
- Indicador visual de columna ordenada

#### Filtrado por Período
- Solo muestra predicciones del período seleccionado
- Períodos: Mes, Trimestre, Año

---

## Modal de Detalles

### Componente: PredictionDetailModal.jsx

### Estructura del Modal

#### 1. Selector de Período
- **Botones:** Mes, Trimestre, Año
- **Función:** Cambia el período de predicción y recalcula
- **Estado:** `selectedPeriod` (month/quarter/year)

#### 2. Tarjeta Principal: Predicción Final

**Diseño:** Una sola línea horizontal

**Elementos:**
- **Icono:** Gráfico de barras (HiChartBar)
- **Label:** "Predicción Final:"
- **Valor:** Número grande con formato (ej: "7,692")
- **Unidad:** "unidades para Próximo Año (365 días)"

**Datos:**
- `results.adjusted_prediction`: Predicción final después de todos los ajustes
- Formateado con `.toLocaleString()` para separadores de miles

#### 3. Tarjetas Secundarias (4 columnas)

##### 3.1. Stock Actual
- **Dato:** `product.total_stock`
- **Origen:** Suma de todas las cantidades de lotes del producto
- **Formato:** Número formateado

##### 3.2. Déficit
- **Cálculo:** `max(0, adjusted_prediction - total_stock)`
- **Color:**
  - Rojo si déficit > 0
  - Verde si déficit = 0 (suficiente stock)

##### 3.3. Confianza
- **Dato:** `results.confidence_level`
- **Badge:** Color según nivel (verde/amarillo/rojo)
- **Formato:** Porcentaje (ej: "45%")

##### 3.4. Metodología
- **Dato:** `results.algorithm_used`
- **Mapeo:**
  - `exponential_moving_average` → "Promedio Móvil Exponencial (EMA)"
  - `weighted_moving_average` → "Promedio Móvil Ponderado"
  - `moving_average` → "Promedio Móvil Simple"
  - `linear_regression_combined` → "Promedio Ponderado + Regresión Lineal"

#### 4. Sección: Datos Históricos Utilizados

**Estado:** Expandida por defecto

**Subsecciones:**

##### 4.1. Resumen del Período
- **Período analizado:** Fecha inicio - Fecha fin
- **Días con datos:** Cantidad de días que tienen registros de consumo

##### 4.2. Estadísticas (4 tarjetas)

**4.2.1. Consumo Promedio Diario**
- **Dato:** `historicalData.summary.mean`
- **Fórmula mostrada:** `Σx / n = suma / cantidad`
- **Cálculo:** Suma de todos los consumos diarios dividido entre número de días

**4.2.2. Desviación Estándar**
- **Dato:** `historicalData.summary.std_deviation`
- **Fórmula mostrada:** `√varianza`
- **Interpretación:** Mide qué tan dispersos están los valores del promedio

**4.2.3. Coeficiente de Variación**
- **Dato:** `historicalData.summary.coefficient_of_variation`
- **Fórmula mostrada:** `(σ / μ) × 100`
- **Interpretación:** Variabilidad relativa (más útil que desviación estándar sola)

**4.2.4. Rango de Consumo**
- **Dato:** `historicalData.summary.min - max`
- **Interpretación:** Mínimo y máximo consumo diario observado

##### 4.3. Gráfico de Barras
- **Datos:** Últimos 30 días de consumo
- **Visualización:** Barras proporcionales a consumo
- **Altura:** `(valor / máximo) × 100%`
- **Tooltip:** Muestra día y cantidad al hover

#### 5. Sección: Metodología de Cálculo Paso a Paso

**Estado:** Expandida por defecto

**Pasos mostrados:**

##### Paso 1: Análisis Estadístico
- Muestra estadísticas descriptivas calculadas
- Promedio, Desviación Estándar, CV

##### Paso 2: Definir Período
- Muestra el período seleccionado (Mes/Trimestre/Año)
- Muestra cantidad de días del período

##### Paso 3: Calcular Predicción Base
- Muestra el algoritmo usado
- Muestra la fórmula del algoritmo
- Muestra promedio diario calculado
- Muestra proyección: `promedio_diario × días_período`
- Muestra pasos detallados del cálculo

**Ejemplo para EMA:**
```
Paso 1: Calcular EMA inicial usando primeros 30 valores
  → Promedio simple de [5, 10, 8, ...] = 8.86

Paso 2: Aplicar fórmula EMA recursivamente
  → EMA día 31: (0.2 × 13) + (0.8 × 8.86) = 9.69
  → EMA día 32: (0.2 × 10) + (0.8 × 9.69) = 9.75
  ...

Promedio diario calculado: 9.75 unidades
Proyección: 9.75 × 365 días = 3,558.75 unidades
```

##### Paso 4: Aplicar Regresión Lineal (solo si aplica)
- Muestra ecuación de tendencia: `y = mx + b`
- Muestra pendiente (m) e intercepto (b)
- Muestra predicción por tendencia
- Muestra combinación: `(EMA × 0.7) + (Regresión × 0.3)`

##### Paso 5: Aplicar Ajustes
- Muestra cada ajuste aplicado:
  1. **Estacionalidad:**
     - Operación: `Predicción Base × Factor Estacional`
     - Resultado: Nueva predicción
     - Explicación: Interpretación del factor
  2. **Tendencia Histórica:**
     - Operación: `Predicción Estacional × Multiplicador`
     - Resultado: Nueva predicción
     - Explicación: Descripción de la tendencia detectada
  3. **Demanda Extra:**
     - Operación: `Predicción Tendencia + Demanda Extra`
     - Resultado: Predicción final
     - Explicación: Basado en datos históricos reales

#### 6. Sección: Análisis de Confianza

**Estado:** Expandida por defecto

**Contenido:**

##### 6.1. Nivel de Confianza Final
- Badge grande con porcentaje
- Color según nivel (verde/amarillo/rojo)

##### 6.2. Factores Considerados
Lista de factores que afectaron la confianza:

**Factor 1: Cantidad de Datos Históricos**
- Valor: Número de días
- Impacto: +X% o -X%
- Razón: Explicación del impacto

**Factor 2: Coeficiente de Variación**
- Valor: Porcentaje (ej: "35%")
- Impacto: +X% o -X%
- Razón: Interpretación del CV

##### 6.3. Ajustes por Período
- Factor: Nombre del factor (ej: "Período de predicción largo")
- Ajuste: Porcentaje (ej: "-20%")
- Razón: Explicación del ajuste

#### 7. Sección: Recomendación

**Diseño:** Caja verde con gradiente

**Contenido:**

##### 7.1. Stock de Seguridad Recomendado
- **Cálculo:** `adjusted_prediction × 0.2` (20% de la predicción)
- **Fórmula mostrada:** "(20% de la predicción ajustada)"
- **Propósito:** Margen de seguridad para variaciones inesperadas

##### 7.2. Cantidad a Pedir
- **Cálculo:** `max(0, adjusted_prediction - total_stock + safety_stock)`
- **Fórmula mostrada:** "(Predicción - Stock Actual + Stock de Seguridad)"
- **Interpretación:** Cantidad que se debe pedir para cubrir la demanda predicha más el margen de seguridad

**Ejemplo:**
- Predicción: 1,000 unidades
- Stock Actual: 600 unidades
- Stock Seguridad: 200 unidades (20% de 1,000)
- Cantidad a Pedir: 1,000 - 600 + 200 = **600 unidades**

---

## Flujo Completo de Datos

### Escenario: Usuario solicita ver predicción de un producto

#### 1. Frontend: Click en "Detalles"
```javascript
// PredictionsTable.jsx
onClick={() => {
  setSelectedProduct(row)
  setShowDetail(true)
}}
```

#### 2. Frontend: Query para obtener predicción detallada
```javascript
// PredictionDetailModal.jsx
const { data: detailedPrediction } = useQuery({
  queryKey: ['prediction-detailed', productId, selectedPeriod],
  queryFn: async () => {
    const response = await api.get(
      `/predictions/product/${productId}/calculate?period=${selectedPeriod}`
    )
    return response.data.data
  }
})
```

#### 3. Backend: Endpoint recibe request
```javascript
// routes/predictions.js
router.get('/product/:productId/calculate', async (req, res) => {
  const productId = parseInt(req.params.productId)
  const period = req.query.period || 'month'
  const prediction = await predictionEngine.predictConsumption(productId, period)
  res.json({ success: true, data: prediction })
})
```

#### 4. Backend: Obtener datos históricos
```javascript
// predictionEngine.js
const historical = await getHistoricalConsumption(productId, areaId, 90)
// Query SQL:
// SELECT * FROM stock_history 
// WHERE product_id = ? AND action = 'remove'
// AND consumption_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
```

#### 5. Backend: Calcular estadísticas
```javascript
const stats = calculateStatistics(historicalData)
// Calcula: mean, std_deviation, coefficient_of_variation, min, max
```

#### 6. Backend: Seleccionar y ejecutar algoritmo
```javascript
if (historicalData.length >= 30) {
  // Usar EMA
  const ema = calculateExponentialMovingAverage(historicalData, 30, 0.2)
  predictedQuantity = ema.value * daysInPeriod
} else if (historicalData.length >= 14) {
  // Usar WMA
  const wma = calculateWeightedMovingAverage(historicalData, 14)
  predictedQuantity = wma.value * daysInPeriod
} else {
  // Usar MA simple
  const ma = calculateMovingAverage(historicalData, 7)
  predictedQuantity = ma.value * daysInPeriod
}
```

#### 7. Backend: Aplicar ajustes
```javascript
const adjustments = applyAdjustments(predictedQuantity, productId, period, historicalData)
// Aplica: estacionalidad, tendencia histórica, demanda extra
```

#### 8. Backend: Calcular confianza
```javascript
const confidence = calculateConfidenceLevel(historicalData, adjustedPrediction)
// Considera: cantidad de datos, variabilidad, período, volatilidad
```

#### 9. Backend: Construir respuesta
```javascript
return {
  product_id: productId,
  prediction_period: period,
  historical_data: { ... },
  calculation_methodology: [ ... ],
  final_results: {
    predicted_quantity: basePrediction,
    adjusted_prediction: adjustments.adjusted_prediction,
    confidence_level: finalConfidence,
    algorithm_used: algorithmUsed,
    recommended_safety_stock: adjustedPrediction * 0.2
  }
}
```

#### 10. Frontend: Renderizar modal
- Muestra tarjeta principal con predicción final
- Muestra tarjetas secundarias (stock, déficit, confianza, metodología)
- Muestra secciones expandibles con detalles completos

---

## Términos y Conceptos Clave

### Algoritmos

1. **Promedio Móvil Simple (MA):** Promedio aritmético de los últimos N días
2. **Promedio Móvil Ponderado (WMA):** Promedio donde días recientes tienen más peso
3. **Promedio Móvil Exponencial (EMA):** Promedio que da peso exponencial a datos recientes
4. **Regresión Lineal:** Método para encontrar tendencia usando ecuación y = mx + b

### Estadísticas

1. **Media (μ):** Promedio aritmético
2. **Desviación Estándar (σ):** Medida de dispersión de los datos
3. **Coeficiente de Variación (CV):** Variabilidad relativa (σ/μ × 100)
4. **Varianza:** σ² (desviación estándar al cuadrado)

### Conceptos de Predicción

1. **Predicción Base:** Resultado del algoritmo antes de ajustes
2. **Predicción Ajustada:** Resultado final después de todos los ajustes
3. **Stock de Seguridad:** Margen adicional (20%) para cubrir variaciones
4. **Déficit:** Cantidad faltante para cubrir la predicción
5. **Cobertura:** Porcentaje de la predicción cubierto por stock actual

### Factores de Ajuste

1. **Estacionalidad:** Variación según mes del año
2. **Tendencia Histórica:** Cambio detectado comparando períodos
3. **Volatilidad:** Medida de cambios bruscos en el consumo

---

## Consideraciones Técnicas

### Rendimiento

- Las predicciones se calculan bajo demanda (no se cachean)
- Los datos históricos se limitan a 90 días para optimizar consultas
- Los cálculos se realizan en memoria (muy rápidos)

### Precisión

- Requiere mínimo 7 días de datos históricos
- Mayor precisión con 30+ días de datos
- La confianza refleja la calidad de los datos disponibles

### Limitaciones

- No considera eventos externos específicos (pandemias, desastres)
- Asume continuidad de patrones históricos
- Los ajustes de estacionalidad son aproximados (basados en función sinusoidal)

---

## Conclusión

El módulo de predicciones es un sistema completo y transparente que:

1. **Utiliza datos reales** de consumo histórico
2. **Aplica algoritmos estadísticos** probados (MA, WMA, EMA, Regresión)
3. **Considera múltiples factores** (estacionalidad, tendencias, variabilidad)
4. **Calcula confianza** basada en calidad y cantidad de datos
5. **Proporciona transparencia total** mostrando cada paso del cálculo
6. **Ofrece recomendaciones** prácticas (stock de seguridad, cantidad a pedir)

Todo el sistema está diseñado para ser **exacto, preciso y completamente explicable**, permitiendo a los usuarios entender cómo se llegó a cada predicción y tomar decisiones informadas sobre la gestión de inventario.

