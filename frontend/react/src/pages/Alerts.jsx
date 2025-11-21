import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import Loading from '../components/common/Loading'
import { HiBell, HiCheckCircle, HiRefresh } from 'react-icons/hi'
import './Alerts.css'

export default function Alerts() {
  const queryClient = useQueryClient()
  const [alertType, setAlertType] = useState('all')
  const [severity, setSeverity] = useState('all')

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts', alertType, severity],
    queryFn: async () => {
      const response = await api.get('/alerts')
      let data = response.data.data || []
      
      if (alertType !== 'all') {
        data = data.filter(a => a.alert_type === alertType)
      }
      
      if (severity !== 'all') {
        data = data.filter(a => a.severity === severity)
      }
      
      return data
    }
  })

  const resolveMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.put(`/alerts/${id}/resolve`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alerts'])
      queryClient.invalidateQueries(['dashboard-stats'])
    }
  })

  const checkAlertsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/alerts/check')
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['alerts'])
      queryClient.invalidateQueries(['dashboard-stats'])
    }
  })

  const getAlertTypeLabel = (type) => {
    const labels = {
      expired: 'Vencido',
      expiring_soon: 'Por Vencer',
      low_stock: 'Stock Bajo',
      prediction_insufficient: 'Déficit Predicción',
      no_rfid: 'Sin Tag'
    }
    return labels[type] || type
  }

  const getSeverityVariant = (severity) => {
    const variants = {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'default'
    }
    return variants[severity] || 'default'
  }

  const columns = [
    { key: 'id', field: 'id', header: 'ID', className: 'col-id' },
    {
      key: 'alert_type',
      field: 'alert_type',
      header: 'Tipo',
      render: (value) => <Badge variant="info" size="sm">{getAlertTypeLabel(value)}</Badge>
    },
    {
      key: 'severity',
      field: 'severity',
      header: 'Severidad',
      render: (value) => (
        <Badge variant={getSeverityVariant(value)} size="sm">
          {value}
        </Badge>
      )
    },
    { key: 'message', field: 'message', header: 'Mensaje' },
    {
      key: 'created_at',
      field: 'created_at',
      header: 'Fecha',
      render: (value) => new Date(value).toLocaleDateString('es-ES')
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="table-actions">
          <Button
            size="sm"
            variant="success"
            onClick={() => resolveMutation.mutate(row.id)}
            loading={resolveMutation.isPending}
          >
            <HiCheckCircle />
            Resolver
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="alerts-page">
      <div className="page-header">
        <div>
          <h1>Alertas del Sistema</h1>
          <p className="page-subtitle">Gestionar y resolver alertas automáticas</p>
        </div>
        <Button
          variant="primary"
          onClick={() => checkAlertsMutation.mutate()}
          loading={checkAlertsMutation.isPending}
        >
          <HiRefresh />
          Verificar Alertas
        </Button>
      </div>

      <Card shadow="md">
        <div className="alerts-filters">
          <div className="filter-group">
            <label>Tipo:</label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todos</option>
              <option value="expired">Vencidos</option>
              <option value="expiring_soon">Por Vencer</option>
              <option value="low_stock">Stock Bajo</option>
              <option value="prediction_insufficient">Déficit Predicción</option>
              <option value="no_rfid">Sin Tag</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Severidad:</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </div>
      </Card>

      <Card shadow="md" className="alerts-table-card">
        {isLoading ? (
          <Loading text="Cargando alertas..." />
        ) : (
          <Table
            columns={columns}
            data={alerts || []}
            emptyMessage="No hay alertas activas"
          />
        )}
      </Card>
    </div>
  )
}

