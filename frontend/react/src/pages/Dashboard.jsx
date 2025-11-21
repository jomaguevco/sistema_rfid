import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import ConsumptionChart from '../components/dashboard/ConsumptionChart'
import CategoryDistribution from '../components/dashboard/CategoryDistribution'
import ExpiryDistribution from '../components/dashboard/ExpiryDistribution'
import ConsumptionTrend from '../components/dashboard/ConsumptionTrend'
import PredictionsSummary from '../components/dashboard/PredictionsSummary'
import { HiCube, HiExclamationCircle, HiClock, HiTrendingDown, HiCheckCircle, HiBell, HiChartBar } from 'react-icons/hi'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const response = await api.get('/dashboard/stats')
        return response.data.data || {}
      } catch (error) {
        console.error('Error al cargar estadísticas:', error)
        return {}
      }
    }
  })

  const { data: prescriptions, isLoading: loadingPrescriptions } = useQuery({
    queryKey: ['recent-prescriptions'],
    queryFn: async () => {
      try {
        const response = await api.get('/prescriptions?limit=5')
        return response.data.data || []
      } catch (error) {
        return []
      }
    },
    enabled: !isAdmin // Solo cargar para Farmacéutico
  })

  if (isLoading) {
    return <Loading fullScreen text="Cargando dashboard..." />
  }

  const metrics = [
    {
      label: 'Total Medicamentos',
      value: stats?.total_products || 0,
      icon: HiCube,
      color: 'primary'
    },
    {
      label: 'Medicamentos Vencidos',
      value: stats?.expired_products || 0,
      icon: HiExclamationCircle,
      color: 'error'
    },
    {
      label: 'Por Vencer',
      value: stats?.expiring_soon || 0,
      icon: HiClock,
      color: 'warning'
    },
    {
      label: 'Stock Bajo',
      value: stats?.low_stock_products || 0,
      icon: HiTrendingDown,
      color: 'warning'
    },
    {
      label: 'Stock Total',
      value: stats?.total_stock || 0,
      icon: HiCheckCircle,
      color: 'success'
    }
  ]

  if (isAdmin) {
    metrics.push({
      label: 'Alertas',
      value: stats?.total_alerts || 0,
      icon: HiBell,
      color: 'info'
    })
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">
          {isAdmin ? 'Vista general del sistema' : 'Resumen de actividades'}
        </p>
      </div>

      {isAdmin && (
        <div className="dashboard-section">
          <Card title="Accesos Rápidos" shadow="md" className="quick-actions-card">
            <div className="quick-actions">
              <Button
                variant="ghost"
                className="quick-action-btn"
                onClick={() => navigate('/products')}
                fullWidth
              >
                <HiCube />
                <span>Gestionar Medicamentos</span>
              </Button>
              <Button
                variant="ghost"
                className="quick-action-btn"
                onClick={() => navigate('/prescriptions')}
                fullWidth
              >
                <HiCheckCircle />
                <span>Ver Recetas</span>
              </Button>
              <Button
                variant="ghost"
                className="quick-action-btn"
                onClick={() => navigate('/predictions')}
                fullWidth
              >
                <HiChartBar />
                <span>Predicciones</span>
              </Button>
              <Button
                variant="ghost"
                className="quick-action-btn"
                onClick={() => navigate('/reports')}
                fullWidth
              >
                <HiChartBar />
                <span>Ver Reportes</span>
              </Button>
              <Button
                variant="ghost"
                className="quick-action-btn"
                onClick={() => navigate('/alerts')}
                fullWidth
              >
                <HiBell />
                <span>Ver Alertas</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="dashboard-metrics">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index} className="metric-card" shadow="md">
              <div className="metric-content">
                <div className={`metric-icon metric-icon-${metric.color}`}>
                  <Icon />
                </div>
                <div className="metric-info">
                  <div className="metric-value">{metric.value.toLocaleString()}</div>
                  <div className="metric-label">{metric.label}</div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {!isAdmin && (
        <div className="dashboard-section">
          <Card title="Recetas Recientes" shadow="md">
            {loadingPrescriptions ? (
              <Loading text="Cargando recetas..." />
            ) : prescriptions && prescriptions.length > 0 ? (
              <div className="prescriptions-list">
                {prescriptions.map((prescription) => (
                  <div key={prescription.id} className="prescription-item">
                    <div className="prescription-info">
                      <span className="prescription-code">{prescription.prescription_code}</span>
                      <span className="prescription-patient">{prescription.patient_name}</span>
                    </div>
                    <span className={`prescription-status prescription-status-${prescription.status}`}>
                      {prescription.status === 'pending' && 'Pendiente'}
                      {prescription.status === 'partial' && 'Parcial'}
                      {prescription.status === 'fulfilled' && 'Completo'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">No hay recetas recientes</p>
            )}
          </Card>
        </div>
      )}

      {isAdmin && (
        <>
          <div className="dashboard-charts-grid">
            <ConsumptionChart days={30} />
            <CategoryDistribution />
          </div>

          <div className="dashboard-charts-grid">
            <ExpiryDistribution />
            <ConsumptionTrend days={30} />
          </div>

          <div className="dashboard-section">
            <PredictionsSummary />
          </div>
        </>
      )}
    </div>
  )
}
