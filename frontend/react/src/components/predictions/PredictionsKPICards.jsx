import { useMemo } from 'react'
import Card from '../common/Card'
import Badge from '../common/Badge'
import { HiTrendingUp, HiTrendingDown, HiExclamationCircle, HiCheckCircle, HiChartBar } from 'react-icons/hi'
import './PredictionsKPICards.css'

export default function PredictionsKPICards({ predictions }) {
  const kpis = useMemo(() => {
    if (!predictions || predictions.length === 0) {
      return {
        totalPredictions: 0,
        totalPredictedQuantity: 0,
        totalCurrentStock: 0,
        totalDeficit: 0,
        productsWithDeficit: 0,
        averageConfidence: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0
      }
    }

    const totalPredictedQuantity = predictions.reduce((sum, p) => {
      const val = Number(p.predicted_quantity) || 0
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
    
    const totalCurrentStock = predictions.reduce((sum, p) => {
      const val = Number(p.current_stock) || 0
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
    
    const totalDeficit = predictions.reduce((sum, p) => {
      const predicted = Number(p.predicted_quantity) || 0
      const stock = Number(p.current_stock) || 0
      const deficit = predicted - stock
      return sum + (deficit > 0 && !isNaN(deficit) ? deficit : 0)
    }, 0)
    
    const productsWithDeficit = predictions.filter(p => {
      const predicted = Number(p.predicted_quantity) || 0
      const stock = Number(p.current_stock) || 0
      const deficit = predicted - stock
      return deficit > 0 && !isNaN(deficit)
    }).length

    const totalConfidence = predictions.reduce((sum, p) => {
      const val = Number(p.confidence_level) || 0
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
    
    const averageConfidence = predictions.length > 0 && !isNaN(totalConfidence) 
      ? totalConfidence / predictions.length 
      : 0

    const highConfidenceCount = predictions.filter(p => (p.confidence_level || 0) >= 80).length
    const mediumConfidenceCount = predictions.filter(p => {
      const conf = p.confidence_level || 0
      return conf >= 50 && conf < 80
    }).length
    const lowConfidenceCount = predictions.filter(p => (p.confidence_level || 0) < 50).length

    const safeTotalPredicted = isNaN(totalPredictedQuantity) ? 0 : Math.round(totalPredictedQuantity)
    const safeTotalStock = isNaN(totalCurrentStock) ? 0 : Math.round(totalCurrentStock)
    const safeTotalDeficit = isNaN(totalDeficit) ? 0 : Math.round(totalDeficit)
    const safeAvgConfidence = isNaN(averageConfidence) ? 0 : Math.round(averageConfidence)

    return {
      totalPredictions: predictions.length,
      totalPredictedQuantity: safeTotalPredicted,
      totalCurrentStock: safeTotalStock,
      totalDeficit: safeTotalDeficit,
      productsWithDeficit,
      averageConfidence: safeAvgConfidence,
      highConfidenceCount,
      mediumConfidenceCount,
      lowConfidenceCount,
      deficitPercentage: safeTotalStock > 0 
        ? Math.round((safeTotalDeficit / safeTotalStock) * 100) 
        : safeTotalDeficit > 0 ? 100 : 0
    }
  }, [predictions])

  const kpiCards = [
    {
      title: 'Total Predicciones',
      value: kpis.totalPredictions,
      icon: HiChartBar,
      color: 'primary',
      subtitle: 'Productos analizados'
    },
    {
      title: 'Consumo Previsto',
      value: (kpis.totalPredictedQuantity || 0).toLocaleString('es-ES'),
      icon: HiTrendingUp,
      color: 'info',
      subtitle: 'Unidades estimadas',
      suffix: 'unidades'
    },
    {
      title: 'Stock Actual',
      value: (kpis.totalCurrentStock || 0).toLocaleString('es-ES'),
      icon: HiCheckCircle,
      color: 'success',
      subtitle: 'Unidades disponibles',
      suffix: 'unidades'
    },
    {
      title: 'Déficit Estimado',
      value: (kpis.totalDeficit || 0).toLocaleString('es-ES'),
      icon: HiExclamationCircle,
      color: kpis.totalDeficit > 0 ? 'error' : 'success',
      subtitle: `${kpis.productsWithDeficit} productos afectados`,
      suffix: 'unidades',
      highlight: kpis.totalDeficit > 0
    },
    {
      title: 'Confianza Promedio',
      value: `${kpis.averageConfidence}%`,
      icon: HiTrendingUp,
      color: kpis.averageConfidence >= 80 ? 'success' : kpis.averageConfidence >= 50 ? 'warning' : 'error',
      subtitle: `${kpis.highConfidenceCount} alta, ${kpis.mediumConfidenceCount} media, ${kpis.lowConfidenceCount} baja`
    }
  ]

  return (
    <div className="predictions-kpi-cards">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <Card key={index} shadow="md" className={`kpi-card kpi-card-${kpi.color} ${kpi.highlight ? 'kpi-card-highlight' : ''}`}>
            <div className="kpi-card-content">
              <div className="kpi-card-header">
                <div className="kpi-card-icon">
                  <Icon />
                </div>
                <div className="kpi-card-title">{kpi.title}</div>
              </div>
              <div className="kpi-card-value">
                {kpi.value}
                {kpi.suffix && <span className="kpi-card-suffix">{kpi.suffix}</span>}
              </div>
              <div className="kpi-card-subtitle">{kpi.subtitle}</div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

