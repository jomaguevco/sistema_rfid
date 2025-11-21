import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Card from '../common/Card'
import Table from '../common/Table'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Modal from '../common/Modal'
import PredictionDetailModal from './PredictionDetailModal'
import { HiRefresh, HiEye } from 'react-icons/hi'
import './PredictionsTable.css'

export default function PredictionsTable({ predictions, period, onRefresh }) {
  const queryClient = useQueryClient()
  const { canPerformAction } = useAuth()
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const canRegenerate = canPerformAction('predictions', 'create')

  const regenerateMutation = useMutation({
    mutationFn: async (productId) => {
      const response = await api.post(`/predictions/product/${productId}/generate`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['predictions'])
      onRefresh?.()
    }
  })

  const getPeriodLabel = (p) => {
    const labels = {
      month: 'Mes',
      quarter: 'Trimestre',
      year: 'Año'
    }
    return labels[p] || p
  }

  const columns = [
    {
      key: 'product_name',
      field: 'product_name',
      header: 'Medicamento',
      className: 'col-product'
    },
    {
      key: 'predicted_quantity',
      field: 'predicted_quantity',
      header: 'Predicción',
      render: (value) => (
        <Badge variant="info" size="sm">
          {Math.round(value || 0)} unidades
        </Badge>
      )
    },
    {
      key: 'current_stock',
      field: 'current_stock',
      header: 'Stock Actual',
      render: (value) => (
        <Badge variant={value > 0 ? 'success' : 'error'} size="sm">
          {value || 0}
        </Badge>
      )
    },
    {
      key: 'deficit',
      header: 'Déficit',
      render: (_, row) => {
        const deficit = (row.predicted_quantity || 0) - (row.current_stock || 0)
        if (deficit <= 0) return <Badge variant="success" size="sm">Suficiente</Badge>
        return <Badge variant="error" size="sm">{Math.round(deficit)} faltantes</Badge>
      }
    },
    {
      key: 'confidence_level',
      field: 'confidence_level',
      header: 'Confianza',
      render: (value) => {
        const conf = Math.round(value || 0)
        let variant = 'default'
        if (conf >= 80) variant = 'success'
        else if (conf >= 50) variant = 'warning'
        else variant = 'error'
        return <Badge variant={variant} size="sm">{conf}%</Badge>
      }
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="table-actions">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              setSelectedProduct(row)
              setShowDetail(true)
            }}
          >
            <HiEye />
            Ver Detalles
          </Button>
          {canRegenerate && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => regenerateMutation.mutate(row.product_id)}
              loading={regenerateMutation.isPending}
            >
              <HiRefresh />
              Regenerar
            </Button>
          )}
        </div>
      )
    }
  ]

  return (
    <>
      <Card shadow="md" className="predictions-table-card">
        <div className="table-header">
          <h3>Predicciones para el {getPeriodLabel(period)}</h3>
          <p className="table-subtitle">
            {predictions.length} predicciones generadas
          </p>
        </div>
        {predictions.length === 0 ? (
          <div className="empty-state">
            <p>No hay predicciones disponibles para este período.</p>
            <p className="empty-hint">Genera predicciones para ver los resultados.</p>
          </div>
        ) : (
          <Table
            columns={columns}
            data={predictions}
            emptyMessage="No hay predicciones disponibles"
          />
        )}
      </Card>

      {showDetail && selectedProduct && (
        <PredictionDetailModal
          productId={selectedProduct.product_id}
          isOpen={showDetail}
          onClose={() => {
            setShowDetail(false)
            setSelectedProduct(null)
          }}
        />
      )}
    </>
  )
}

