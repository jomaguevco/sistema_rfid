const db = require('../database_medical');

/**
 * Motor de predicción de consumo
 * Utiliza diferentes algoritmos según la cantidad de datos disponibles
 */

/**
 * Calcular promedio móvil simple
 */
function calculateMovingAverage(data, period) {
  if (data.length < period) {
    return null; // No hay suficientes datos
  }

  const recentData = data.slice(-period);
  const sum = recentData.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Calcular promedio móvil ponderado (más peso a datos recientes)
 */
function calculateWeightedMovingAverage(data, period) {
  if (data.length < period) {
    return null;
  }

  const recentData = data.slice(-period);
  let weightedSum = 0;
  let weightSum = 0;

  recentData.forEach((value, index) => {
    const weight = index + 1; // Peso creciente
    weightedSum += value * weight;
    weightSum += weight;
  });

  return weightedSum / weightSum;
}

/**
 * Calcular regresión lineal simple
 */
function calculateLinearRegression(data) {
  if (data.length < 2) {
    return null;
  }

  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  data.forEach((value, index) => {
    const x = index + 1;
    sumX += x;
    sumY += value;
    sumXY += x * value;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Calcular nivel de confianza basado en cantidad de datos y variabilidad
 */
function calculateConfidenceLevel(data, predictedValue) {
  if (data.length < 7) {
    return 30; // Muy poca confianza con menos de una semana
  }
  if (data.length < 30) {
    return 50; // Confianza media con menos de un mes
  }

  // Calcular desviación estándar
  const mean = data.reduce((acc, val) => acc + val, 0) / data.length;
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  // Confianza basada en variabilidad
  let confidence = 100;
  if (coefficientOfVariation > 0.5) {
    confidence = 60; // Alta variabilidad
  } else if (coefficientOfVariation > 0.3) {
    confidence = 75;
  } else {
    confidence = 90; // Baja variabilidad, alta confianza
  }

  return Math.round(confidence);
}

/**
 * Obtener datos históricos de consumo
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

    // Agrupar por día
    const dailyConsumption = {};
    history.forEach(record => {
      if (record.action === 'remove') {
        const date = record.consumption_date || record.created_at.toISOString().split('T')[0];
        if (!dailyConsumption[date]) {
          dailyConsumption[date] = 0;
        }
        dailyConsumption[date] += (record.previous_stock - record.new_stock);
      }
    });

    // Convertir a array ordenado por fecha
    const consumptionArray = Object.keys(dailyConsumption)
      .sort()
      .map(date => dailyConsumption[date]);

    return consumptionArray;
  } catch (error) {
    console.error('Error al obtener consumo histórico:', error);
    return [];
  }
}

/**
 * Predecir consumo para un período específico
 */
async function predictConsumption(productId, period, areaId = null) {
  try {
    // Obtener datos históricos (últimos 90 días mínimo)
    const historicalData = await getHistoricalConsumption(productId, areaId, 90);

    if (historicalData.length < 7) {
      // No hay suficientes datos
      return {
        predicted_quantity: 0,
        confidence_level: 0,
        algorithm_used: 'insufficient_data',
        message: 'No hay suficientes datos históricos para hacer una predicción confiable'
      };
    }

    let predictedQuantity = 0;
    let algorithmUsed = 'moving_average';
    let confidence = 0;

    // Calcular promedio diario
    const dailyAverage = calculateMovingAverage(historicalData, Math.min(historicalData.length, 30));

    if (dailyAverage === null) {
      return {
        predicted_quantity: 0,
        confidence_level: 0,
        algorithm_used: 'insufficient_data'
      };
    }

    // Calcular predicción según período
    let daysInPeriod = 0;
    switch (period) {
      case 'month':
        daysInPeriod = 30;
        break;
      case 'quarter':
        daysInPeriod = 90;
        break;
      case 'year':
        daysInPeriod = 365;
        break;
      default:
        daysInPeriod = 30;
    }

    // Usar promedio móvil ponderado si hay suficientes datos
    if (historicalData.length >= 14) {
      const weightedAvg = calculateWeightedMovingAverage(historicalData, Math.min(historicalData.length, 14));
      if (weightedAvg !== null) {
        predictedQuantity = weightedAvg * daysInPeriod;
        algorithmUsed = 'weighted_moving_average';
      } else {
        predictedQuantity = dailyAverage * daysInPeriod;
      }
    } else {
      predictedQuantity = dailyAverage * daysInPeriod;
    }

    // Si hay suficientes datos, intentar regresión lineal para tendencias
    if (historicalData.length >= 30 && period === 'year') {
      const regression = calculateLinearRegression(historicalData);
      if (regression) {
        const trendPrediction = regression.intercept + (regression.slope * daysInPeriod);
        if (trendPrediction > 0) {
          // Combinar promedio con tendencia (70% promedio, 30% tendencia)
          predictedQuantity = (predictedQuantity * 0.7) + (trendPrediction * 0.3);
          algorithmUsed = 'linear_regression_combined';
        }
      }
    }

    // Calcular nivel de confianza
    confidence = calculateConfidenceLevel(historicalData, predictedQuantity);

    // Ajustar confianza según período (predicciones más largas tienen menos confianza)
    if (period === 'year') {
      confidence = Math.max(confidence - 20, 30);
    } else if (period === 'quarter') {
      confidence = Math.max(confidence - 10, 40);
    }

    return {
      predicted_quantity: Math.round(predictedQuantity),
      confidence_level: confidence,
      algorithm_used: algorithmUsed,
      historical_data_points: historicalData.length
    };
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

      if (prediction.predicted_quantity > 0 || prediction.confidence_level > 0) {
        // Calcular fechas del período
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

        // Guardar predicción en base de datos
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
            prediction.predicted_quantity,
            prediction.confidence_level,
            prediction.algorithm_used,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0]
          ]
        );

        predictions.push({
          period,
          ...prediction,
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
  getHistoricalConsumption
};

