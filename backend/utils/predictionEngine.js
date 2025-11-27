const db = require('../database_medical');

/**
 * Motor de predicción de consumo con cálculos detallados
 * Proporciona transparencia total en cada paso del cálculo
 */

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE CÁLCULO MATEMÁTICO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcular promedio móvil simple con detalles
 * @returns {Object} { value, formula, steps }
 */
function calculateMovingAverage(data, period) {
  if (data.length < period) {
    return { value: null, formula: null, steps: [] };
  }

  const recentData = data.slice(-period);
  const sum = recentData.reduce((acc, val) => acc + val, 0);
  const average = sum / period;

  return {
    value: average,
    formula: `Σ(consumo_diario) / n = ${sum.toFixed(2)} / ${period}`,
    steps: [
      {
        step: 1,
        description: `Seleccionar últimos ${period} días de datos`,
        values: recentData,
        result: `${period} valores seleccionados`
      },
      {
        step: 2,
        description: 'Sumar todos los valores',
        operation: recentData.map(v => v.toFixed(2)).join(' + '),
        result: sum.toFixed(2)
      },
      {
        step: 3,
        description: 'Dividir suma entre número de días',
        operation: `${sum.toFixed(2)} ÷ ${period}`,
        result: average.toFixed(4)
      }
    ]
  };
}

/**
 * Calcular promedio móvil ponderado con detalles
 * Fórmula: Σ(valor × peso) / Σ(peso)
 * Donde peso = posición (1, 2, 3, ..., n) - más reciente tiene mayor peso
 */
function calculateWeightedMovingAverage(data, period) {
  if (data.length < period) {
    return { value: null, formula: null, steps: [] };
  }

  const recentData = data.slice(-period);
  let weightedSum = 0;
  let weightSum = 0;
  const weightedValues = [];

  recentData.forEach((value, index) => {
    const weight = index + 1;
    weightedSum += value * weight;
    weightSum += weight;
    weightedValues.push({
      day: index + 1,
      value: value,
      weight: weight,
      weighted_value: value * weight
    });
  });

  const average = weightedSum / weightSum;

  return {
    value: average,
    formula: `Σ(consumo × peso) / Σ(peso) = ${weightedSum.toFixed(2)} / ${weightSum}`,
    weighted_values: weightedValues,
    steps: [
      {
        step: 1,
        description: `Seleccionar últimos ${period} días y asignar pesos (1 a ${period})`,
        detail: 'Día más antiguo = peso 1, día más reciente = peso máximo',
        result: `${period} valores con pesos asignados`
      },
      {
        step: 2,
        description: 'Multiplicar cada valor por su peso',
        values: weightedValues.map(wv => `${wv.value.toFixed(2)} × ${wv.weight} = ${wv.weighted_value.toFixed(2)}`),
        result: 'Valores ponderados calculados'
      },
      {
        step: 3,
        description: 'Sumar todos los valores ponderados',
        operation: weightedValues.map(wv => wv.weighted_value.toFixed(2)).join(' + '),
        result: weightedSum.toFixed(2)
      },
      {
        step: 4,
        description: 'Sumar todos los pesos',
        operation: weightedValues.map(wv => wv.weight).join(' + '),
        result: weightSum.toString()
      },
      {
        step: 5,
        description: 'Dividir suma ponderada entre suma de pesos',
        operation: `${weightedSum.toFixed(2)} ÷ ${weightSum}`,
        result: average.toFixed(4)
      }
    ]
  };
}

/**
 * Calcular regresión lineal simple con detalles
 * y = mx + b donde m = pendiente, b = intercepto
 */
function calculateLinearRegression(data) {
  if (data.length < 2) {
    return { value: null, formula: null, steps: [] };
  }

  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  const dataPoints = data.map((value, index) => {
    const x = index + 1;
    sumX += x;
    sumY += value;
    sumXY += x * value;
    sumX2 += x * x;
    return { x, y: value, xy: x * value, x2: x * x };
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    formula: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
    steps: [
      {
        step: 1,
        description: 'Asignar valores X (día 1, 2, 3...) a cada punto de datos',
        result: `${n} puntos de datos preparados`
      },
      {
        step: 2,
        description: 'Calcular sumatorias necesarias',
        values: {
          'Σx': sumX.toFixed(2),
          'Σy': sumY.toFixed(2),
          'Σxy': sumXY.toFixed(2),
          'Σx²': sumX2.toFixed(2),
          'n': n
        }
      },
      {
        step: 3,
        description: 'Calcular pendiente (m)',
        formula: 'm = (n×Σxy - Σx×Σy) / (n×Σx² - (Σx)²)',
        operation: `(${n} × ${sumXY.toFixed(2)} - ${sumX.toFixed(2)} × ${sumY.toFixed(2)}) / (${n} × ${sumX2.toFixed(2)} - ${sumX.toFixed(2)}²)`,
        result: slope.toFixed(4)
      },
      {
        step: 4,
        description: 'Calcular intercepto (b)',
        formula: 'b = (Σy - m×Σx) / n',
        operation: `(${sumY.toFixed(2)} - ${slope.toFixed(4)} × ${sumX.toFixed(2)}) / ${n}`,
        result: intercept.toFixed(4)
      }
    ]
  };
}

/**
 * Calcular estadísticas descriptivas con detalles
 */
function calculateStatistics(data) {
  const n = data.length;
  const sum = data.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;
  
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean !== 0 ? (stdDev / mean) * 100 : 0;
  
  const sortedData = [...data].sort((a, b) => a - b);
  const min = sortedData[0];
  const max = sortedData[n - 1];
  const median = n % 2 === 0 
    ? (sortedData[n/2 - 1] + sortedData[n/2]) / 2 
    : sortedData[Math.floor(n/2)];

  return {
    count: n,
    sum: Number(sum.toFixed(2)),
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    variance: Number(variance.toFixed(4)),
    std_deviation: Number(stdDev.toFixed(4)),
    coefficient_of_variation: Number(coefficientOfVariation.toFixed(2)),
    calculations: {
      mean_formula: `Σx / n = ${sum.toFixed(2)} / ${n} = ${mean.toFixed(4)}`,
      variance_formula: `Σ(x - μ)² / n = ${variance.toFixed(4)}`,
      std_dev_formula: `√varianza = √${variance.toFixed(4)} = ${stdDev.toFixed(4)}`,
      cv_formula: `(σ / μ) × 100 = (${stdDev.toFixed(4)} / ${mean.toFixed(4)}) × 100 = ${coefficientOfVariation.toFixed(2)}%`
    }
  };
}

/**
 * Calcular nivel de confianza con explicación detallada
 */
function calculateConfidenceLevel(data, predictedValue) {
  const stats = calculateStatistics(data);
  let confidence = 100;
  const factors = [];

  // Factor 1: Cantidad de datos
  if (data.length < 7) {
    confidence = 30;
    factors.push({
      factor: 'Cantidad de datos históricos',
      value: data.length,
      impact: -70,
      reason: 'Menos de 7 días de datos = muy baja confianza'
    });
  } else if (data.length < 30) {
    confidence = 50;
    factors.push({
      factor: 'Cantidad de datos históricos',
      value: data.length,
      impact: -50,
      reason: 'Entre 7 y 30 días de datos = confianza media'
    });
  } else {
    factors.push({
      factor: 'Cantidad de datos históricos',
      value: data.length,
      impact: 0,
      reason: 'Más de 30 días de datos = base sólida'
    });
  }

  // Factor 2: Variabilidad (solo si hay suficientes datos)
  if (data.length >= 7) {
    if (stats.coefficient_of_variation > 50) {
      confidence = Math.min(confidence, 60);
      factors.push({
        factor: 'Coeficiente de variación',
        value: `${stats.coefficient_of_variation.toFixed(2)}%`,
        impact: -40,
        reason: 'CV > 50% indica alta variabilidad en el consumo'
      });
    } else if (stats.coefficient_of_variation > 30) {
      confidence = Math.min(confidence, 75);
      factors.push({
        factor: 'Coeficiente de variación',
        value: `${stats.coefficient_of_variation.toFixed(2)}%`,
        impact: -25,
        reason: 'CV entre 30% y 50% indica variabilidad moderada'
      });
    } else {
      factors.push({
        factor: 'Coeficiente de variación',
        value: `${stats.coefficient_of_variation.toFixed(2)}%`,
        impact: 0,
        reason: 'CV < 30% indica consumo estable'
      });
    }
  }

  return {
    value: Math.round(confidence),
    factors,
    statistics: stats
  };
}

/**
 * Obtener factor de estacionalidad con explicación
 */
function getSeasonalityFactor(period, productId) {
  const month = new Date().getMonth();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  // Factor base usando función sinusoidal
  const base = 1 + (Math.sin((month + productId) * 0.3) * 0.05);
  
  let factor, adjustment;
  if (period === 'quarter') {
    factor = Number((base + 0.04).toFixed(4));
    adjustment = 0.04;
  } else if (period === 'year') {
    factor = Number((base + 0.07).toFixed(4));
    adjustment = 0.07;
  } else {
    factor = Number(base.toFixed(4));
    adjustment = 0;
  }

  return {
    value: factor,
    calculation: {
      current_month: monthNames[month],
      base_formula: '1 + sin((mes + id_producto) × 0.3) × 0.05',
      base_value: Number(base.toFixed(4)),
      period_adjustment: adjustment,
      final_value: factor,
      interpretation: factor > 1 
        ? `Se espera ${((factor - 1) * 100).toFixed(1)}% más de demanda` 
        : `Se espera ${((1 - factor) * 100).toFixed(1)}% menos de demanda`
    }
  };
}

/**
 * Escenarios externos predefinidos
 */
const EXTERNAL_SCENARIOS = [
  {
    id: 0,
    note: 'Campaña de vacunación regional',
    demandMultiplier: 1.08,
    extraDemand: 25,
    volatility: 'medium',
    description: 'Incremento esperado por campañas de salud pública'
  },
  {
    id: 1,
    note: 'Entrega extraordinaria confirmada',
    demandMultiplier: 0.95,
    extraDemand: -15,
    volatility: 'low',
    description: 'Reducción temporal por reabastecimiento especial'
  },
  {
    id: 2,
    note: 'Alerta epidemiológica en curso',
    demandMultiplier: 1.15,
    extraDemand: 40,
    volatility: 'high',
    description: 'Alta demanda por situación sanitaria especial'
  },
  {
    id: 3,
    note: 'Estacionalidad baja registrada',
    demandMultiplier: 0.9,
    extraDemand: -5,
    volatility: 'medium',
    description: 'Período de menor consumo histórico'
  },
  {
    id: 4,
    note: 'Incremento en derivaciones interhospitalarias',
    demandMultiplier: 1.12,
    extraDemand: 30,
    volatility: 'medium',
    description: 'Mayor afluencia de pacientes derivados'
  }
];

function getExternalScenario(productId, period) {
  const scenario = EXTERNAL_SCENARIOS[productId % EXTERNAL_SCENARIOS.length];
  const scaling = period === 'quarter' ? 1.5 : period === 'year' ? 2 : 1;
  
  return {
    ...scenario,
    extraDemand: Math.round(scenario.extraDemand * scaling),
    scaling_factor: scaling,
    calculation: {
      base_extra_demand: scenario.extraDemand,
      period_scaling: scaling,
      final_extra_demand: Math.round(scenario.extraDemand * scaling)
    }
  };
}

/**
 * Aplicar ajustes con cálculos detallados
 */
function applyAdjustments(baseQuantity, productId, period) {
  const seasonality = getSeasonalityFactor(period, productId);
  const externalScenario = getExternalScenario(productId, period);

  // Paso 1: Aplicar estacionalidad
  const afterSeasonality = baseQuantity * seasonality.value;
  
  // Paso 2: Aplicar multiplicador externo
  const afterMultiplier = afterSeasonality * externalScenario.demandMultiplier;
  
  // Paso 3: Agregar demanda extra
  let finalPrediction = afterMultiplier + externalScenario.extraDemand;
  if (finalPrediction < 0) finalPrediction = 0;

  return {
    adjusted_prediction: Math.round(finalPrediction),
    seasonality_factor: seasonality.value,
    external_adjustment: externalScenario,
    calculation_steps: [
      {
        step: 1,
        name: 'Aplicar factor de estacionalidad',
        operation: `${baseQuantity.toFixed(2)} × ${seasonality.value}`,
        result: afterSeasonality.toFixed(2),
        explanation: seasonality.calculation.interpretation
      },
      {
        step: 2,
        name: 'Aplicar multiplicador del escenario externo',
        operation: `${afterSeasonality.toFixed(2)} × ${externalScenario.demandMultiplier}`,
        result: afterMultiplier.toFixed(2),
        explanation: `Escenario: ${externalScenario.note}`
      },
      {
        step: 3,
        name: 'Agregar demanda adicional del escenario',
        operation: `${afterMultiplier.toFixed(2)} + ${externalScenario.extraDemand}`,
        result: Math.max(0, finalPrediction).toFixed(2),
        explanation: externalScenario.description
      }
    ],
    seasonality_details: seasonality.calculation,
    scenario_details: externalScenario
  };
}

/**
 * Obtener datos históricos de consumo con detalles
 */
async function getHistoricalConsumption(productId, areaId = null, days = 90) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filters = {
      area_id: areaId,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };

    const history = await db.getStockHistory(productId, filters);

    // Agrupar por día con detalles
    const dailyConsumption = {};
    const dailyDetails = {};
    
    history.forEach(record => {
      if (record.action === 'remove') {
        const date = record.consumption_date || record.created_at.toISOString().split('T')[0];
        const consumed = record.previous_stock - record.new_stock;
        
        if (!dailyConsumption[date]) {
          dailyConsumption[date] = 0;
          dailyDetails[date] = [];
        }
        dailyConsumption[date] += consumed;
        dailyDetails[date].push({
          quantity: consumed,
          previous_stock: record.previous_stock,
          new_stock: record.new_stock,
          notes: record.notes
        });
      }
    });

    // Convertir a arrays ordenados
    const dates = Object.keys(dailyConsumption).sort();
    const consumptionArray = dates.map(date => dailyConsumption[date]);

    return {
      values: consumptionArray,
      dates: dates,
      daily_details: dailyDetails,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days_requested: days,
        days_with_data: dates.length
      }
    };
  } catch (error) {
    console.error('Error al obtener consumo histórico:', error);
    return {
      values: [],
      dates: [],
      daily_details: {},
      period: { start: null, end: null, days_requested: days, days_with_data: 0 }
    };
  }
}

/**
 * Predecir consumo con cálculos completamente detallados
 */
async function predictConsumption(productId, period, areaId = null) {
  try {
    const historical = await getHistoricalConsumption(productId, areaId, 90);
    const historicalData = historical.values;

    // Construir respuesta detallada
    const result = {
      product_id: productId,
      area_id: areaId,
      prediction_period: period,
      timestamp: new Date().toISOString(),
      historical_data: {
        period: historical.period,
        data_points: historicalData.length,
        dates: historical.dates,
        values: historicalData,
        summary: historicalData.length > 0 ? calculateStatistics(historicalData) : null
      },
      calculation_methodology: [],
      adjustments_applied: [],
      final_results: {}
    };

    if (historicalData.length < 7) {
      result.calculation_methodology.push({
        step: 1,
        name: 'Validación de datos',
        status: 'INSUFICIENTE',
        detail: `Solo hay ${historicalData.length} días de datos. Se requieren mínimo 7 días para una predicción confiable.`
      });
      
      result.final_results = {
        predicted_quantity: 0,
        adjusted_prediction: 0,
        confidence_level: 0,
        algorithm_used: 'insufficient_data',
        message: 'No hay suficientes datos históricos para hacer una predicción confiable. Se requieren al menos 7 días de historial de consumo.'
      };
      
      return result;
    }

    // Paso 1: Calcular estadísticas descriptivas
    const stats = calculateStatistics(historicalData);
    result.calculation_methodology.push({
      step: 1,
      name: 'Análisis estadístico de datos históricos',
      status: 'COMPLETADO',
      statistics: stats
    });

    // Determinar período
    let daysInPeriod = 0;
    let periodName = '';
    switch (period) {
      case 'month':
        daysInPeriod = 30;
        periodName = 'Próximo Mes (30 días)';
        break;
      case 'quarter':
        daysInPeriod = 90;
        periodName = 'Próximo Trimestre (90 días)';
        break;
      case 'year':
        daysInPeriod = 365;
        periodName = 'Próximo Año (365 días)';
        break;
      default:
        daysInPeriod = 30;
        periodName = 'Próximo Mes (30 días)';
    }

    result.calculation_methodology.push({
      step: 2,
      name: 'Definir período de predicción',
      status: 'COMPLETADO',
      period: periodName,
      days: daysInPeriod
    });

    // Paso 3: Calcular predicción base
    let predictedQuantity = 0;
    let algorithmUsed = 'moving_average';
    let algorithmDetails = {};

    // Promedio simple como respaldo
    const simpleAvg = calculateMovingAverage(historicalData, Math.min(historicalData.length, 30));

    if (historicalData.length >= 14) {
      // Usar promedio ponderado
      const weightedAvg = calculateWeightedMovingAverage(historicalData, Math.min(historicalData.length, 14));
      
      if (weightedAvg.value !== null) {
        predictedQuantity = weightedAvg.value * daysInPeriod;
        algorithmUsed = 'weighted_moving_average';
        algorithmDetails = {
          method: 'Promedio Móvil Ponderado',
          description: 'Los datos más recientes tienen mayor peso en el cálculo',
          formula: weightedAvg.formula,
          daily_average: Number(weightedAvg.value.toFixed(4)),
          calculation_steps: weightedAvg.steps,
          projection: {
            formula: `${weightedAvg.value.toFixed(4)} × ${daysInPeriod} días`,
            result: predictedQuantity.toFixed(2)
          }
        };
      }
    } else {
      // Usar promedio simple
      if (simpleAvg.value !== null) {
        predictedQuantity = simpleAvg.value * daysInPeriod;
        algorithmDetails = {
          method: 'Promedio Móvil Simple',
          description: 'Promedio aritmético de los últimos días disponibles',
          formula: simpleAvg.formula,
          daily_average: Number(simpleAvg.value.toFixed(4)),
          calculation_steps: simpleAvg.steps,
          projection: {
            formula: `${simpleAvg.value.toFixed(4)} × ${daysInPeriod} días`,
            result: predictedQuantity.toFixed(2)
          }
        };
      }
    }

    result.calculation_methodology.push({
      step: 3,
      name: 'Calcular predicción base',
      status: 'COMPLETADO',
      algorithm: algorithmDetails
    });

    // Paso 4: Regresión lineal para períodos largos
    if (historicalData.length >= 30 && period === 'year') {
      const regression = calculateLinearRegression(historicalData);
      
      if (regression.slope !== null) {
        const trendPrediction = regression.intercept + (regression.slope * daysInPeriod);
        
        if (trendPrediction > 0) {
          const originalPrediction = predictedQuantity;
          predictedQuantity = (predictedQuantity * 0.7) + (trendPrediction * 0.3);
          algorithmUsed = 'linear_regression_combined';
          
          result.calculation_methodology.push({
            step: 4,
            name: 'Aplicar corrección por tendencia (Regresión Lineal)',
            status: 'COMPLETADO',
            regression: {
              formula: regression.formula,
              slope: regression.slope,
              intercept: regression.intercept,
              trend_prediction: Number(trendPrediction.toFixed(2)),
              steps: regression.steps
            },
            combination: {
              description: 'Combinar promedio ponderado (70%) con tendencia (30%)',
              formula: `(${originalPrediction.toFixed(2)} × 0.7) + (${trendPrediction.toFixed(2)} × 0.3)`,
              result: predictedQuantity.toFixed(2)
            }
          });
        }
      }
    }

    // Paso 5: Aplicar ajustes
    const basePrediction = Math.max(predictedQuantity, 0);
    const adjustments = applyAdjustments(basePrediction, productId, period);

    result.calculation_methodology.push({
      step: 5,
      name: 'Aplicar ajustes por estacionalidad y escenarios externos',
      status: 'COMPLETADO',
      base_prediction: Number(basePrediction.toFixed(2)),
      adjustments: adjustments.calculation_steps,
      seasonality_details: adjustments.seasonality_details,
      scenario_details: adjustments.scenario_details,
      final_adjusted: adjustments.adjusted_prediction
    });

    // Paso 6: Calcular confianza
    const confidence = calculateConfidenceLevel(historicalData, adjustments.adjusted_prediction);
    let finalConfidence = confidence.value;

    // Ajustar por período
    const confidenceAdjustments = [];
    if (period === 'year') {
      confidenceAdjustments.push({
        factor: 'Período de predicción largo (año)',
        adjustment: -20,
        reason: 'Mayor incertidumbre en predicciones a largo plazo'
      });
      finalConfidence = Math.max(finalConfidence - 20, 30);
    } else if (period === 'quarter') {
      confidenceAdjustments.push({
        factor: 'Período de predicción medio (trimestre)',
        adjustment: -10,
        reason: 'Incertidumbre moderada'
      });
      finalConfidence = Math.max(finalConfidence - 10, 40);
    }

    if (adjustments.external_adjustment.volatility === 'high') {
      confidenceAdjustments.push({
        factor: 'Escenario de alta volatilidad',
        adjustment: -15,
        reason: 'El escenario actual aumenta la incertidumbre'
      });
      finalConfidence = Math.max(finalConfidence - 15, 20);
    }

    result.calculation_methodology.push({
      step: 6,
      name: 'Calcular nivel de confianza',
      status: 'COMPLETADO',
      base_confidence: confidence.value,
      factors: confidence.factors,
      period_adjustments: confidenceAdjustments,
      final_confidence: finalConfidence
    });

    // Resultados finales
    result.final_results = {
      predicted_quantity: Math.round(basePrediction),
      adjusted_prediction: adjustments.adjusted_prediction,
      base_prediction: Math.round(basePrediction),
      confidence_level: finalConfidence,
      algorithm_used: algorithmUsed,
      seasonality_factor: adjustments.seasonality_factor,
      external_adjustment: adjustments.external_adjustment,
      recommended_safety_stock: Math.round(adjustments.adjusted_prediction * 0.2),
      historical_data_points: historicalData.length,
      summary: {
        prediction_for: periodName,
        daily_average_consumption: stats.mean,
        total_predicted: adjustments.adjusted_prediction,
        confidence: `${finalConfidence}%`,
        methodology: algorithmUsed === 'weighted_moving_average' 
          ? 'Promedio Móvil Ponderado' 
          : algorithmUsed === 'linear_regression_combined'
            ? 'Promedio Ponderado + Regresión Lineal'
            : 'Promedio Móvil Simple'
      }
    };

    return result;
  } catch (error) {
    console.error('Error al predecir consumo:', error);
    throw error;
  }
}

/**
 * Generar y guardar predicciones para un producto
 */
async function generateAndSavePredictions(productId, areaId = null) {
  try {
    const periods = ['month', 'quarter', 'year'];
    const predictions = [];

    for (const period of periods) {
      const prediction = await predictConsumption(productId, period, areaId);
      const results = prediction.final_results;

      if (results.predicted_quantity > 0 || results.confidence_level > 0) {
        const startDate = new Date();
        let endDate = new Date();
        
        switch (period) {
          case 'month':
            endDate.setMonth(endDate.getMonth() + 1);
            break;
          case 'quarter':
            endDate.setMonth(endDate.getMonth() + 3);
            break;
          case 'year':
            endDate.setFullYear(endDate.getFullYear() + 1);
            break;
        }

        const [result] = await db.pool.execute(
          `INSERT INTO consumption_predictions 
           (product_id, area_id, prediction_period, predicted_quantity, confidence_level, 
            algorithm_used, start_date, end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           predicted_quantity = VALUES(predicted_quantity),
           confidence_level = VALUES(confidence_level),
           algorithm_used = VALUES(algorithm_used),
           calculation_date = CURRENT_TIMESTAMP`,
          [
            productId,
            areaId,
            period,
            results.predicted_quantity,
            results.confidence_level,
            results.algorithm_used,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          ]
        );

        predictions.push({
          period,
          ...results,
          id: result.insertId || null
        });
      }
    }

    return predictions;
  } catch (error) {
    console.error('Error al generar predicciones:', error);
    throw error;
  }
}

/**
 * Obtener predicciones existentes para un producto
 */
async function getPredictions(productId, areaId = null) {
  try {
    let query = `
      SELECT * FROM consumption_predictions
      WHERE product_id = ? AND calculation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;
    const params = [productId];

    if (areaId !== null) {
      query += ' AND area_id = ?';
      params.push(areaId);
    } else {
      query += ' AND area_id IS NULL';
    }

    query += ' ORDER BY prediction_period, calculation_date DESC';

    const [rows] = await db.pool.execute(query, params);
    return rows;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  predictConsumption,
  generateAndSavePredictions,
  getPredictions,
  getHistoricalConsumption,
  applyAdjustments,
  calculateStatistics,
  calculateMovingAverage,
  calculateWeightedMovingAverage,
  calculateLinearRegression,
  calculateConfidenceLevel
};
