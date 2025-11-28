import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import Badge from '../components/common/Badge'
import ConsumptionChart from '../components/dashboard/ConsumptionChart'
import CategoryDistribution from '../components/dashboard/CategoryDistribution'
import ExpiryDistribution from '../components/dashboard/ExpiryDistribution'
import ConsumptionTrend from '../components/dashboard/ConsumptionTrend'
import PredictionsSummary from '../components/dashboard/PredictionsSummary'
import { 
  HiCube, 
  HiExclamationCircle, 
  HiClock, 
  HiTrendingDown, 
  HiCheckCircle, 
  HiBell, 
  HiChartBar,
  HiArrowRight,
  HiShieldCheck
} from 'react-icons/hi'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { hasRole, user, loading: authLoading } = useAuth()

  const isMedico = user?.role === 'medico'

  // Esperar a que se cargue la autenticación
  if (authLoading || !user) {
    return <Loading fullScreen text="Cargando..." />
  }

  // Si es médico, redirigir inmediatamente a la página de recetas
  if (isMedico) {
    return <Navigate to="/prescriptions" replace />
  }

  const isChemist = user.role === 'farmaceutico'
  const isAdmin = user.role === 'admin'

  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const response = await api.get('/dashboard/stats')
        if (!response.data.success) {
          throw new Error(response.data.error || 'Error al obtener estadísticas')
        }
        return response.data.data || {}
      } catch (error) {
        console.error('Error al cargar estadísticas:', error)
        throw error
      }
    },
    retry: 2,
    refetchOnWindowFocus: true,
    enabled: !isMedico
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
    enabled: !isAdmin
  })

  const { data: lowStockData = [], isLoading: loadingLowStock, error: lowStockError } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => {
      const response = await api.get('/dashboard/low-stock')
      return (response.data.data || []).slice(0, 5)
    },
    enabled: isChemist
  })

  const { data: expiringSoon = [], isLoading: loadingExpiring, error: expiringError } = useQuery({
    queryKey: ['dashboard-expiring'],
    queryFn: async () => {
      const response = await api.get('/dashboard/expiring?days=30')
      return (response.data.data || []).slice(0, 5)
    },
    enabled: isChemist
  })

  const { data: chemistPredictionsSummary, isLoading: loadingChemistPredictions, error: chemistPredictionsError } = useQuery({
    queryKey: ['dashboard-predictions-summary'],
    queryFn: async () => {
      const response = await api.get('/dashboard/predictions-summary')
      return response.data.data || {}
    },
    enabled: isChemist
  })

  if (isLoading) {
    return <Loading fullScreen text="Cargando dashboard..." />
  }

  if (statsError) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Vista general del sistema</p>
        </div>
        <Card className="error-card" shadow="md">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <HiExclamationCircle style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '1rem' }} />
            <h2 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Error al cargar datos</h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              {statsError.response?.status === 401 
                ? 'No estás autenticado. Por favor, inicia sesión nuevamente.'
                : statsError.response?.status === 403
                ? 'Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión nuevamente.'
                : statsError.response?.status === 500
                ? 'Error en el servidor. Verifica que el backend esté corriendo y la base de datos esté conectada.'
                : statsError.message || 'Error desconocido al conectar con el servidor.'
              }
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
              {(statsError.response?.status === 401 || statsError.response?.status === 403) ? (
                <Button 
                  onClick={() => {
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    window.location.href = '/login'
                  }}
                  variant="primary"
                >
                  Ir al Login
                </Button>
              ) : (
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="primary"
                >
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Métricas principales
  const criticalMetrics = [
    {
      label: 'Medicamentos Vencidos',
      value: stats?.expired_products || 0,
      icon: HiExclamationCircle,
      color: 'error',
      priority: 'high'
    },
    {
      label: 'Por Vencer (30 días)',
      value: stats?.expiring_soon || 0,
      icon: HiClock,
      color: 'warning',
      priority: 'high'
    },
    {
      label: 'Stock Bajo',
      value: stats?.low_stock_products || 0,
      icon: HiTrendingDown,
      color: 'warning',
      priority: 'high'
    }
  ]

  const generalMetrics = [
    {
      label: 'Total Productos',
      value: stats?.total_products || 0,
      icon: HiCube,
      color: 'primary'
    },
    {
      label: 'Stock Total',
      value: stats?.total_stock || 0,
      icon: HiCheckCircle,
      color: 'success'
    }
  ]

  if (isAdmin || isChemist) {
    generalMetrics.push({
      label: 'Alertas Activas',
      value: stats?.total_alerts || 0,
      icon: HiBell,
      color: 'info'
    })
  }

  const renderLowStockList = () => {
    if (loadingLowStock) return <Loading text="Cargando..." size="sm" />
    if (lowStockError) return <p className="empty-message">Error al cargar datos.</p>
    if (!lowStockData.length) return <p className="empty-message">No hay productos con stock bajo.</p>
    return (
      <div className="insights-list">
        {lowStockData.map((item) => (
          <div key={item.id} className="insight-row">
            <div className="insight-main">
              <strong>{item.name}</strong>
              <span className="insight-meta">{item.category_name || 'Sin categoría'}</span>
            </div>
            <div className="insight-kpis">
              <Badge variant={item.current_stock <= 0 ? 'error' : 'warning'}>
                {Math.round(item.current_stock || 0)} / {Math.round(item.min_stock || 0)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderExpiringList = () => {
    if (loadingExpiring) return <Loading text="Cargando..." size="sm" />
    if (expiringError) return <p className="empty-message">Error al cargar datos.</p>
    if (!expiringSoon.length) return <p className="empty-message">No hay lotes próximos a vencer.</p>
    return (
      <div className="insights-list">
        {expiringSoon.map((batch) => (
          <div key={`${batch.product_id}-${batch.id || batch.lot_number}`} className="insight-row">
            <div className="insight-main">
              <strong>{batch.product_name}</strong>
              <span className="insight-meta">
                Lote {batch.lot_number || 'N/A'} · {batch.days_to_expiry} días
              </span>
            </div>
            <div className="insight-kpis">
              <Badge variant={batch.days_to_expiry <= 7 ? 'error' : 'warning'}>
                {Math.round(batch.quantity || 0)} uds
              </Badge>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderChemistPredictions = () => {
    if (loadingChemistPredictions) return <Loading text="Cargando..." size="sm" />
    if (chemistPredictionsError) return <p className="empty-message">Error al cargar datos.</p>
    if (!chemistPredictionsSummary) return <p className="empty-message">No hay datos disponibles.</p>

    const monthData = chemistPredictionsSummary.month || {}
    const quarterData = chemistPredictionsSummary.quarter || {}
    const yearData = chemistPredictionsSummary.year || {}
    const topDeficit = (chemistPredictionsSummary.top_deficit || []).slice(0, 5)
    const deficitRate = monthData.total > 0 
      ? Math.round(((monthData.insufficient || 0) / monthData.total) * 100) 
      : 0

    return (
      <>
        <div className="prediction-kpis">
          <div className="prediction-kpi">
            <span className="kpi-label">Próximo Mes</span>
            <div className="kpi-value">{monthData.total || 0}</div>
            <p className="kpi-helper">
              {monthData.insufficient || 0} con déficit ({deficitRate}%)
            </p>
          </div>
          <div className="prediction-kpi">
            <span className="kpi-label">Próximo Trimestre</span>
            <div className="kpi-value">{quarterData.total || 0}</div>
            <p className="kpi-helper">Actualizados semanalmente</p>
          </div>
          <div className="prediction-kpi">
            <span className="kpi-label">Próximo Año</span>
            <div className="kpi-value">{yearData.total || 0}</div>
            <p className="kpi-helper">Cobertura global</p>
          </div>
        </div>
        {topDeficit.length > 0 && (
          <div className="top-deficit-list">
            <h4 style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
              Productos con Mayor Déficit
            </h4>
            {topDeficit.map((item) => (
              <div key={`${item.product_id}-${item.id}`} className="top-deficit-item">
                <div>
                  <strong>{item.product_name}</strong>
                  <span className="insight-meta">
                    Stock: {Math.round(item.current_stock || 0)} · Demanda: {Math.round(item.predicted_quantity || 0)}
                  </span>
                </div>
                <Badge variant="error">
                  Déficit: {Math.round(item.deficit || 0)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">
            {isAdmin
              ? 'Vista general del sistema de gestión de inventario'
              : isChemist
              ? 'Monitoreo integral de stock y predicciones de consumo'
              : 'Resumen de actividades y estado del inventario'}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            onClick={() => navigate('/predictions')}
            icon={<HiChartBar />}
          >
            Ver Predicciones Completas
            <HiArrowRight style={{ marginLeft: '0.5rem' }} />
          </Button>
        )}
      </div>

      {/* Sección 1: Métricas Críticas (Alertas) */}
      {(criticalMetrics.some(m => m.value > 0) || isAdmin) && (
        <div className="dashboard-section">
          <h2 className="section-title">
            <HiShieldCheck style={{ marginRight: '0.5rem' }} />
            Alertas y Situaciones Críticas
          </h2>
          <div className="dashboard-metrics critical-metrics">
            {criticalMetrics.map((metric, index) => {
              const Icon = metric.icon
              return (
                <Card key={index} className={`metric-card metric-card-${metric.color}`} shadow="md">
                  <div className="metric-content">
                    <div className={`metric-icon metric-icon-${metric.color}`}>
                      <Icon />
                    </div>
                    <div className="metric-info">
                      <div className="metric-value">{Math.round(metric.value).toLocaleString()}</div>
                      <div className="metric-label">{metric.label}</div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Sección 2: Métricas Generales */}
      <div className="dashboard-section">
        <h2 className="section-title">Resumen General</h2>
        <div className="dashboard-metrics">
          {generalMetrics.map((metric, index) => {
            const Icon = metric.icon
            return (
              <Card key={index} className={`metric-card metric-card-${metric.color}`} shadow="md">
                <div className="metric-content">
                  <div className={`metric-icon metric-icon-${metric.color}`}>
                    <Icon />
                  </div>
                  <div className="metric-info">
                    <div className="metric-value">{Math.round(metric.value).toLocaleString()}</div>
                    <div className="metric-label">{metric.label}</div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Sección 3: Alertas Específicas (Solo Farmacéutico) */}
      {isChemist && (
        <div className="dashboard-section">
          <h2 className="section-title">Acciones Requeridas</h2>
          <div className="dashboard-charts-grid">
            <Card title="Stock en Riesgo" shadow="md" className="alert-card">
              {renderLowStockList()}
              {lowStockData.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/alerts')}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  Ver Todas las Alertas
                  <HiArrowRight style={{ marginLeft: '0.5rem' }} />
                </Button>
              )}
            </Card>
            <Card title="Próximos a Vencer" shadow="md" className="alert-card">
              {renderExpiringList()}
              {expiringSoon.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/products')}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  Gestionar Productos
                  <HiArrowRight style={{ marginLeft: '0.5rem' }} />
                </Button>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Sección 4: Predicciones (Solo Farmacéutico) */}
      {isChemist && (
        <div className="dashboard-section">
          <h2 className="section-title">Predicciones de Consumo</h2>
          <Card title="Resumen de Predicciones" shadow="md">
            {renderChemistPredictions()}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #E5E7EB' }}>
              <Button
                variant="primary"
                onClick={() => navigate('/predictions')}
                fullWidth
              >
                <HiChartBar style={{ marginRight: '0.5rem' }} />
                Ver Predicciones Completas
                <HiArrowRight style={{ marginLeft: '0.5rem' }} />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Sección 5: Gráficos y Análisis (Solo Admin) */}
      {isAdmin && (
        <>
          <div className="dashboard-section">
            <h2 className="section-title">Análisis de Consumo</h2>
            <div className="dashboard-charts-grid">
              <ConsumptionTrend days={30} />
              <ConsumptionChart days={30} />
            </div>
          </div>

          <div className="dashboard-section">
            <h2 className="section-title">Distribución y Vencimientos</h2>
            <div className="dashboard-charts-grid">
              <CategoryDistribution />
              <ExpiryDistribution />
            </div>
          </div>

          <div className="dashboard-section">
            <PredictionsSummary />
          </div>
        </>
      )}

      {/* Sección 6: Recetas Recientes (No Admin) */}
      {!isAdmin && (
        <div className="dashboard-section">
          <h2 className="section-title">Recetas Recientes</h2>
          <Card shadow="md">
            {loadingPrescriptions ? (
              <Loading text="Cargando recetas..." />
            ) : prescriptions && prescriptions.length > 0 ? (
              <>
                <div className="prescriptions-list">
                  {prescriptions.map((prescription) => (
                    <div key={prescription.id} className="prescription-item">
                      <div className="prescription-info">
                        <span className="prescription-code">{prescription.prescription_code}</span>
                        <span className="prescription-patient">{prescription.patient_name}</span>
                      </div>
                      <Badge 
                        variant={
                          prescription.status === 'fulfilled' ? 'success' : 
                          prescription.status === 'partial' ? 'warning' : 
                          'info'
                        }
                      >
                        {prescription.status === 'pending' && 'Pendiente'}
                        {prescription.status === 'partial' && 'Parcial'}
                        {prescription.status === 'fulfilled' && 'Completo'}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/prescriptions')}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  Ver Todas las Recetas
                  <HiArrowRight style={{ marginLeft: '0.5rem' }} />
                </Button>
              </>
            ) : (
              <p className="empty-message">No hay recetas recientes</p>
            )}
          </Card>
        </div>
      )}

      {/* Sección 7: Accesos Rápidos (Solo Admin) */}
      {isAdmin && (
        <div className="dashboard-section">
          <h2 className="section-title">Accesos Rápidos</h2>
          <Card shadow="md" className="quick-actions-card">
            <div className="quick-actions">
              <Button
                variant="ghost"
                className="quick-action-btn"
                onClick={() => navigate('/products')}
                fullWidth
              >
                <HiCube />
                <span>Gestionar Productos</span>
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
                <span>Reportes</span>
              </Button>
              <Button
                variant="ghost"
                className="quick-action-btn"
                onClick={() => navigate('/alerts')}
                fullWidth
              >
                <HiBell />
                <span>Alertas</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
