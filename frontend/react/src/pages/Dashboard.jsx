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
import { HiCube, HiExclamationCircle, HiClock, HiTrendingDown, HiCheckCircle, HiBell, HiChartBar } from 'react-icons/hi'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { hasRole, user, loading: authLoading } = useAuth()

  // Debug logs
  const isMedico = user?.role === 'medico'

  console.log('[Dashboard]', { authLoading, user: user?.role, isMedico })

  // Esperar a que se cargue la autenticación
  if (authLoading || !user) {
    return <Loading fullScreen text="Cargando..." />
  }

  // Si es médico, redirigir inmediatamente a la página de recetas (ANTES de cualquier otra lógica)
  if (isMedico) {
    console.log('[Dashboard] Médico detectado, redirigiendo a /prescriptions')
    return <Navigate to="/prescriptions" replace />
  }

  const isChemist = user.role === 'farmaceutico'
  const isAdmin = user.role === 'admin'

  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const response = await api.get('/dashboard/stats')
        console.log('✅ Respuesta del dashboard:', response.data)
        if (!response.data.success) {
          console.error('❌ Error en respuesta del servidor:', response.data.error)
          throw new Error(response.data.error || 'Error al obtener estadísticas')
        }
        return response.data.data || {}
      } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error)
        console.error('Detalles del error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText
        })
        throw error
      }
    },
    retry: 2,
    refetchOnWindowFocus: true,
    enabled: !isMedico // No cargar estadísticas si es médico
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
            {statsError.response?.status === 403 && (
              <p style={{ color: '#999', fontSize: '0.875rem', marginBottom: '1rem' }}>
                {statsError.response?.data?.error || 'Token inválido o expirado'}
              </p>
            )}
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              Estado: {statsError.response?.status || 'Sin conexión'} | 
              URL: {statsError.config?.url || 'N/A'}
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

  if (isAdmin || isChemist) {
    metrics.push({
      label: 'Alertas',
      value: stats?.total_alerts || 0,
      icon: HiBell,
      color: 'info'
    })
  }

  const renderLowStockList = () => {
    if (loadingLowStock) return <Loading text="Cargando stock crítico..." size="sm" />
    if (lowStockError) return <p className="empty-message">No se pudo cargar el stock crítico.</p>
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
                {item.current_stock || 0} / {item.min_stock || 0}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderExpiringList = () => {
    if (loadingExpiring) return <Loading text="Cargando lotes..." size="sm" />
    if (expiringError) return <p className="empty-message">No se pudo cargar la información de vencimientos.</p>
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
                {batch.quantity} uds
              </Badge>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderChemistPredictions = () => {
    if (loadingChemistPredictions) return <Loading text="Analizando predicciones..." size="sm" />
    if (chemistPredictionsError) return <p className="empty-message">No se pudo cargar el resumen de predicciones.</p>
    if (!chemistPredictionsSummary) return <p className="empty-message">No hay datos disponibles.</p>

    const monthData = chemistPredictionsSummary.month || {}
    const quarterData = chemistPredictionsSummary.quarter || {}
    const yearData = chemistPredictionsSummary.year || {}
    const topDeficit = (chemistPredictionsSummary.top_deficit || []).slice(0, 5)
    const deficitRate =
      monthData.total > 0 ? Math.round(((monthData.insufficient || 0) / monthData.total) * 100) : 0

    return (
      <>
        <div className="prediction-kpis">
          <div className="prediction-kpi">
            <span className="kpi-label">Pronósticos mensuales</span>
            <div className="kpi-value">{monthData.total || 0}</div>
            <p className="kpi-helper">
              {monthData.insufficient || 0} con déficit ({deficitRate}%)
            </p>
          </div>
          <div className="prediction-kpi">
            <span className="kpi-label">Pronósticos trimestrales</span>
            <div className="kpi-value">{quarterData.total || 0}</div>
            <p className="kpi-helper">Actualizados semanalmente</p>
          </div>
          <div className="prediction-kpi">
            <span className="kpi-label">Pronósticos anuales</span>
            <div className="kpi-value">{yearData.total || 0}</div>
            <p className="kpi-helper">Cobertura global del hospital</p>
          </div>
        </div>
        {topDeficit.length > 0 ? (
          <div className="top-deficit-list">
            {topDeficit.map((item) => (
              <div key={`${item.product_id}-${item.id}`} className="top-deficit-item">
                <div>
                  <strong>{item.product_name}</strong>
                  <span className="insight-meta">
                    Stock actual {item.current_stock || 0} · Demanda {item.predicted_quantity || 0}
                  </span>
                </div>
                <Badge variant="error">Déficit {item.deficit}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-message">No hay alertas críticas de demanda.</p>
        )}
      </>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">
          {isAdmin
            ? 'Vista general del sistema'
            : isChemist
            ? 'Monitoreo integral de stock y despacho'
            : 'Resumen de actividades'}
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

      {isChemist && (
        <>
          <div className="dashboard-charts-grid">
            <Card title="Stock en riesgo" shadow="md">
              {renderLowStockList()}
            </Card>
            <Card title="Próximos a vencer" shadow="md">
              {renderExpiringList()}
            </Card>
          </div>

          <div className="dashboard-section">
            <Card title="Predicciones y demanda" shadow="md">
              {renderChemistPredictions()}
            </Card>
          </div>
        </>
      )}

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
