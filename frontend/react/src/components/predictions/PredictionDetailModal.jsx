import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import Button from '../common/Button'
import { HiChartBar, HiCalculator, HiDatabase, HiAdjustments, HiShieldCheck, HiChevronDown, HiChevronUp } from 'react-icons/hi'
import './PredictionDetailModal.css'

export default function PredictionDetailModal({ productId, isOpen, onClose }) {
  const [selectedPeriod, setSelectedPeriod] = useState('month')
  const [expandedSections, setExpandedSections] = useState({
    historical: true,  // Expandido por defecto para mostrar datos
    methodology: true,
    statistics: false,
    adjustments: true,
    confidence: true
  })

  // Obtener predicción detallada con cálculos
  const { data: detailedPrediction, isLoading: loadingDetail } = useQuery({
    queryKey: ['prediction-detailed', productId, selectedPeriod],
    queryFn: async () => {
      const response = await api.get(`/predictions/product/${productId}/calculate?period=${selectedPeriod}`)
      return response.data.data
    },
    enabled: isOpen && !!productId
  })

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await api.get(`/products/${productId}`)
      return response.data.data
    },
    enabled: isOpen && !!productId
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const getPeriodLabel = (period) => {
    const labels = {
      month: 'Próximo Mes (30 días)',
      quarter: 'Próximo Trimestre (90 días)',
      year: 'Próximo Año (365 días)'
    }
    return labels[period] || period
  }

  const getConfidenceVariant = (level) => {
    if (level >= 80) return 'success'
    if (level >= 50) return 'warning'
    return 'error'
  }

  const getAlgorithmName = (algorithm) => {
    const names = {
      'moving_average': 'Promedio Móvil Simple',
      'weighted_moving_average': 'Promedio Móvil Ponderado',
      'exponential_moving_average': 'Promedio Móvil Exponencial (EMA)',
      'linear_regression_combined': 'Promedio Ponderado + Regresión Lineal',
      'insufficient_data': 'Sin datos suficientes'
    }
    return names[algorithm] || algorithm
  }

  const renderCollapsibleSection = (key, title, icon, children) => (
    <div className={`detail-section ${expandedSections[key] ? 'expanded' : 'collapsed'}`}>
      <div className="section-header" onClick={() => toggleSection(key)}>
        <div className="section-title">
          {icon}
          <h4>{title}</h4>
        </div>
        {expandedSections[key] ? <HiChevronUp /> : <HiChevronDown />}
      </div>
      {expandedSections[key] && (
        <div className="section-content">
          {children}
        </div>
      )}
    </div>
  )

  const results = detailedPrediction?.final_results || {}
  const methodology = detailedPrediction?.calculation_methodology || []
  const historicalData = detailedPrediction?.historical_data
  
  // Verificar si hay datos para mostrar
  const hasData = !!(detailedPrediction && (results.adjusted_prediction !== undefined || results.predicted_quantity !== undefined))
  const hasHistoricalData = !!(historicalData && historicalData.values && historicalData.values.length > 0)
  const hasMethodology = methodology.length > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Análisis de Predicción: ${product?.name || 'Medicamento'}`}
      size="xl"
    >
      {loadingDetail ? (
        <Loading text="Calculando predicción detallada..." />
      ) : !hasData ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
          <p>No se pudo calcular la predicción. Verifica que haya datos históricos de consumo.</p>
        </div>
      ) : (
        <div className="prediction-detail-v2">
          {/* Selector de período */}
          <div className="period-selector">
            <label>Período de predicción:</label>
            <div className="period-buttons">
              {['month', 'quarter', 'year'].map(period => (
                <button
                  key={period}
                  className={`period-btn ${selectedPeriod === period ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod(period)}
                >
                  {period === 'month' ? 'Mes' : period === 'quarter' ? 'Trimestre' : 'Año'}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen principal */}
          {results && (
            <div className="prediction-summary">
              <div className="summary-card main">
                <div className="summary-icon">
                  <HiChartBar />
                </div>
                <div className="summary-content">
                  <span className="summary-label">Predicción Final</span>
                  <span className="summary-value">{results.adjusted_prediction?.toLocaleString() || 0}</span>
                  <span className="summary-unit">unidades para {getPeriodLabel(selectedPeriod)}</span>
                </div>
              </div>
              
              <div className="summary-cards-row">
                <div className="summary-card">
                  <span className="summary-label">Stock Actual</span>
                  <span className="summary-value small">{product?.total_stock || 0}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Déficit</span>
                  <span className={`summary-value small ${(results.adjusted_prediction - (product?.total_stock || 0)) > 0 ? 'deficit' : 'surplus'}`}>
                    {Math.max(0, results.adjusted_prediction - (product?.total_stock || 0))}
                  </span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Confianza</span>
                  <Badge variant={getConfidenceVariant(results.confidence_level)} size="lg">
                    {results.confidence_level}%
                  </Badge>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Metodología</span>
                  <span className="summary-method">{getAlgorithmName(results.algorithm_used)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Datos Históricos */}
          {historicalData && hasHistoricalData && renderCollapsibleSection('historical', 'Datos Históricos Utilizados', <HiDatabase />, (
            <div className="historical-section">
              <div className="historical-summary">
                <div className="stat-item">
                  <span className="stat-label">Período analizado:</span>
                  <span className="stat-value">{historicalData.period?.start} al {historicalData.period?.end}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Días con datos:</span>
                  <span className="stat-value">{historicalData.data_points} días</span>
                </div>
              </div>
              
              {historicalData.summary && (
                <div className="statistics-grid">
                  <div className="stat-box">
                    <span className="stat-title">Consumo Promedio Diario</span>
                    <span className="stat-number">{historicalData.summary.mean?.toFixed(2)}</span>
                    <span className="stat-formula">{historicalData.summary.calculations?.mean_formula}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-title">Desviación Estándar</span>
                    <span className="stat-number">{historicalData.summary.std_deviation?.toFixed(2)}</span>
                    <span className="stat-formula">{historicalData.summary.calculations?.std_dev_formula}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-title">Coef. de Variación</span>
                    <span className="stat-number">{historicalData.summary.coefficient_of_variation?.toFixed(2)}%</span>
                    <span className="stat-formula">{historicalData.summary.calculations?.cv_formula}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-title">Rango de Consumo</span>
                    <span className="stat-number">{historicalData.summary.min} - {historicalData.summary.max}</span>
                    <span className="stat-formula">Mínimo - Máximo diario</span>
                  </div>
                </div>
              )}

              {historicalData.values?.length > 0 && (
                <div className="consumption-chart">
                  <span className="chart-title">Consumo Diario (últimos {Math.min(30, historicalData.values.length)} días):</span>
                  <div className="mini-chart">
                    {historicalData.values.slice(-30).map((val, idx) => (
                      <div 
                        key={idx} 
                        className="chart-bar"
                        style={{ 
                          height: `${Math.min(100, (val / (historicalData.summary?.max || 1)) * 100)}%` 
                        }}
                        title={`Día ${idx + 1}: ${val} unidades`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Metodología de Cálculo */}
          {hasMethodology && renderCollapsibleSection('methodology', 'Metodología de Cálculo Paso a Paso', <HiCalculator />, (
            <div className="methodology-section">
              {methodology.map((step, index) => (
                <div key={index} className={`method-step ${step.status?.toLowerCase()}`}>
                  <div className="step-header">
                    <span className="step-number">Paso {step.step}</span>
                    <span className="step-name">{step.name}</span>
                    {step.status && (
                      <Badge variant={step.status === 'COMPLETADO' ? 'success' : step.status === 'INSUFICIENTE' ? 'error' : 'info'} size="sm">
                        {step.status}
                      </Badge>
                    )}
                  </div>
                  <div className="step-content">
                    {step.detail && <p className="step-detail">{step.detail}</p>}
                    
                    {/* Estadísticas */}
                    {step.statistics && (
                      <div className="step-stats">
                        <div className="stat-mini">Promedio: <strong>{step.statistics.mean?.toFixed(2)}</strong></div>
                        <div className="stat-mini">Desv. Est.: <strong>{step.statistics.std_deviation?.toFixed(2)}</strong></div>
                        <div className="stat-mini">CV: <strong>{step.statistics.coefficient_of_variation?.toFixed(2)}%</strong></div>
                      </div>
                    )}

                    {/* Algoritmo usado */}
                    {step.algorithm && (
                      <div className="algorithm-details">
                        <div className="alg-header">
                          <strong>{step.algorithm.method}</strong>
                          <span className="alg-desc">{step.algorithm.description}</span>
                        </div>
                        <div className="alg-formula">
                          <span className="formula-label">Fórmula:</span>
                          <code>{step.algorithm.formula}</code>
                        </div>
                        <div className="alg-result">
                          <span>Promedio diario calculado: <strong>{step.algorithm.daily_average?.toFixed(4)}</strong></span>
                        </div>
                        {step.algorithm.projection && (
                          <div className="alg-projection">
                            <span className="formula-label">Proyección:</span>
                            <code>{step.algorithm.projection.formula}</code>
                            <span className="result-value">= <strong>{step.algorithm.projection.result}</strong> unidades</span>
                          </div>
                        )}
                        
                        {/* Pasos detallados del cálculo */}
                        {step.algorithm.calculation_steps && (
                          <div className="calc-steps">
                            <span className="steps-title">Detalles del cálculo:</span>
                            {step.algorithm.calculation_steps.map((calcStep, i) => (
                              <div key={i} className="calc-step">
                                <span className="calc-step-num">{calcStep.step}.</span>
                                <span className="calc-step-desc">{calcStep.description}</span>
                                {calcStep.operation && <code className="calc-operation">{calcStep.operation}</code>}
                                {calcStep.result && <span className="calc-result">→ {calcStep.result}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Regresión lineal */}
                    {step.regression && (
                      <div className="regression-details">
                        <div className="reg-formula">
                          <span className="formula-label">Ecuación de tendencia:</span>
                          <code className="formula-main">{step.regression.formula}</code>
                        </div>
                        <div className="reg-stats">
                          <span>Pendiente (m): <strong>{step.regression.slope?.toFixed(4)}</strong></span>
                          <span>Intercepto (b): <strong>{step.regression.intercept?.toFixed(4)}</strong></span>
                          <span>Predicción por tendencia: <strong>{step.regression.trend_prediction}</strong></span>
                        </div>
                        {step.combination && (
                          <div className="combination-calc">
                            <span className="formula-label">{step.combination.description}:</span>
                            <code>{step.combination.formula}</code>
                            <span className="result-value">= <strong>{step.combination.result}</strong> unidades</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ajustes aplicados */}
                    {step.adjustments && (
                      <div className="adjustments-list">
                        {step.adjustments.map((adj, i) => (
                          <div key={i} className="adjustment-item">
                            <div className="adj-header">
                              <span className="adj-step">{adj.step}.</span>
                              <span className="adj-name">{adj.name}</span>
                            </div>
                            <div className="adj-calc">
                              <code>{adj.operation}</code>
                              <span className="result-value">= <strong>{adj.result}</strong></span>
                            </div>
                            <span className="adj-explanation">{adj.explanation}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Período */}
                    {step.period && (
                      <div className="period-info">
                        <span>Período: <strong>{step.period}</strong></span>
                        <span>Días: <strong>{step.days}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Factores de Confianza */}
          {methodology.find(m => m.name?.includes('confianza')) && renderCollapsibleSection('confidence', 'Análisis de Confianza', <HiShieldCheck />, (
            <div className="confidence-section">
              {(() => {
                const confStep = methodology.find(m => m.name?.includes('confianza'))
                if (!confStep) return null
                
                return (
                  <>
                    <div className="confidence-result">
                      <span className="conf-label">Nivel de confianza final:</span>
                      <Badge variant={getConfidenceVariant(confStep.final_confidence)} size="lg">
                        {confStep.final_confidence}%
                      </Badge>
                    </div>
                    
                    {confStep.factors && confStep.factors.length > 0 && (
                      <div className="confidence-factors">
                        <span className="factors-title">Factores considerados:</span>
                        {confStep.factors.map((factor, i) => (
                          <div key={i} className={`factor-item ${factor.impact < 0 ? 'negative' : 'neutral'}`}>
                            <div className="factor-header">
                              <span className="factor-name">{factor.factor}</span>
                              <span className={`factor-impact ${factor.impact < 0 ? 'negative' : ''}`}>
                                {factor.impact > 0 ? '+' : ''}{factor.impact}%
                              </span>
                            </div>
                            <span className="factor-value">Valor: {factor.value}</span>
                            <span className="factor-reason">{factor.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {confStep.period_adjustments && confStep.period_adjustments.length > 0 && (
                      <div className="period-adjustments">
                        <span className="adjustments-title">Ajustes por período:</span>
                        {confStep.period_adjustments.map((adj, i) => (
                          <div key={i} className="adjustment-factor">
                            <span className="adj-factor-name">{adj.factor}</span>
                            <span className="adj-factor-impact">{adj.adjustment}%</span>
                            <span className="adj-factor-reason">{adj.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          ))}

          {/* Stock de seguridad recomendado */}
          {results && (
            <div className="recommendation-box">
              <div className="recommendation-header">
                <HiAdjustments />
                <h4>Recomendación</h4>
              </div>
              <div className="recommendation-content">
                <div className="rec-item">
                  <span className="rec-label">Stock de Seguridad Recomendado:</span>
                  <span className="rec-value">{results.recommended_safety_stock} unidades</span>
                  <span className="rec-formula">(20% de la predicción ajustada)</span>
                </div>
                <div className="rec-item">
                  <span className="rec-label">Cantidad a Pedir:</span>
                  <span className="rec-value highlight">
                    {Math.max(0, results.adjusted_prediction - (product?.total_stock || 0) + results.recommended_safety_stock)} unidades
                  </span>
                  <span className="rec-formula">(Predicción - Stock Actual + Stock de Seguridad)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
