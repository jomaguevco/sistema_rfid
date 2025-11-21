import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Card from '../common/Card'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import { HiTrendingUp, HiExclamationCircle, HiArrowRight } from 'react-icons/hi'
import './PredictionsSummary.css'

export default function PredictionsSummary() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['predictions-summary'],
    queryFn: async () => {
      const response = await api.get('/dashboard/predictions-summary')
      return response.data.data || {}
    }
  })

  if (isLoading) {
    return (
      <Card shadow="md">
        <Loading text="Cargando resumen de predicciones..." />
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const getPeriodLabel = (period) => {
    const labels = {
      month: 'Mes',
      quarter: 'Trimestre',
      year: 'Año'
    }
    return labels[period] || period
  }

  return (
    <Card shadow="md" title="Resumen de Predicciones" className="predictions-summary">
      <div className="predictions-cards">
        <div className="prediction-card">
          <div className="prediction-header">
            <HiTrendingUp className="prediction-icon" />
            <h4>Próximo Mes</h4>
          </div>
          <div className="prediction-content">
            <div className="prediction-value">{data.month?.total || 0}</div>
            <div className="prediction-label">Predicciones generadas</div>
            {data.month?.insufficient > 0 && (
              <Badge variant="warning" className="prediction-alert">
                <HiExclamationCircle />
                {data.month.insufficient} con déficit
              </Badge>
            )}
          </div>
        </div>

        <div className="prediction-card">
          <div className="prediction-header">
            <HiTrendingUp className="prediction-icon" />
            <h4>Próximo Trimestre</h4>
          </div>
          <div className="prediction-content">
            <div className="prediction-value">{data.quarter?.total || 0}</div>
            <div className="prediction-label">Predicciones generadas</div>
          </div>
        </div>

        <div className="prediction-card">
          <div className="prediction-header">
            <HiTrendingUp className="prediction-icon" />
            <h4>Próximo Año</h4>
          </div>
          <div className="prediction-content">
            <div className="prediction-value">{data.year?.total || 0}</div>
            <div className="prediction-label">Predicciones generadas</div>
          </div>
        </div>
      </div>

      {data.top_deficit && data.top_deficit.length > 0 && (
        <div className="top-deficit">
          <h4>Top Productos con Mayor Déficit (Próximo Mes)</h4>
          <div className="deficit-list">
            {data.top_deficit.slice(0, 5).map((item) => (
              <div key={item.id} className="deficit-item">
                <span className="deficit-product">{item.product_name}</span>
                <Badge variant="error">{item.deficit} unidades faltantes</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="predictions-actions">
        <Button 
          variant="primary" 
          onClick={() => navigate('/predictions')}
          fullWidth
        >
          Ver Predicciones Completas
          <HiArrowRight />
        </Button>
      </div>
    </Card>
  )
}

