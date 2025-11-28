import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Card from '../common/Card'
import Table from '../common/Table'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Input from '../common/Input'
import PredictionDetailModal from './PredictionDetailModal'
import { 
  HiRefresh, 
  HiEye, 
  HiSortAscending, 
  HiSortDescending, 
  HiSearch,
  HiArrowUp,
  HiArrowDown,
  HiArrowRight
} from 'react-icons/hi'
import './PredictionsTable.css'

export default function PredictionsTable({ predictions, period, onRefresh }) {
  const queryClient = useQueryClient()
  const { canPerformAction } = useAuth()
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [sortField, setSortField] = useState('deficit')
  const [sortDirection, setSortDirection] = useState('desc')
  const [tableSearch, setTableSearch] = useState('')
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
      month: 'Próximo Mes',
      quarter: 'Próximo Trimestre',
      year: 'Próximo Año'
    }
    return labels[p] || p
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Calcular datos adicionales para cada predicción
  const enhancedPredictions = useMemo(() => {
    return predictions.map(pred => {
      const predicted = Math.round(pred.predicted_quantity || 0)
      const current = Math.round(pred.current_stock || 0)
      const deficit = Math.max(0, predicted - current)
      
      // Stock recomendado: predicción + 20% de margen de seguridad
      const recommendedStock = Math.round(predicted * 1.2)
      
      // % de cobertura: (Stock Actual / Predicción) × 100
      const coveragePercent = predicted > 0 
        ? Math.round((current / predicted) * 100) 
        : (current > 0 ? 100 : 0)
      
      // Tendencia: comparar con predicción anterior (simulado - en producción vendría del backend)
      // Por ahora, simulamos basado en confianza y déficit
      let trend = 'stable'
      if (deficit > predicted * 0.3) trend = 'increasing'
      else if (deficit < predicted * 0.1 && current > predicted) trend = 'decreasing'
      
      return {
        ...pred,
        predicted_quantity: predicted,
        current_stock: current,
        deficit,
        recommended_stock: recommendedStock,
        coverage_percent: coveragePercent,
        trend
      }
    })
  }, [predictions])

  const sortedAndFilteredPredictions = useMemo(() => {
    let filtered = [...enhancedPredictions]
    
    // Filtrar por búsqueda en tabla
    if (tableSearch.trim()) {
      const search = tableSearch.toLowerCase()
      filtered = filtered.filter(p => 
        (p.product_name || '').toLowerCase().includes(search)
      )
    }
    
    // Ordenar
    filtered.sort((a, b) => {
      let aValue = a[sortField] || 0
      let bValue = b[sortField] || 0
      
      // Para campos numéricos
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      // Para campos de texto
      aValue = String(aValue).toLowerCase()
      bValue = String(bValue).toLowerCase()
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue)
      }
      return bValue.localeCompare(aValue)
    })
    
    return filtered
  }, [enhancedPredictions, sortField, sortDirection, tableSearch])

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? <HiSortAscending /> : <HiSortDescending />
  }

  const TrendIndicator = ({ trend }) => {
    if (trend === 'increasing') {
      return (
        <Badge variant="error" size="sm" title="Tendencia al alza - Mayor demanda esperada">
          <HiArrowUp /> Aumentando
        </Badge>
      )
    } else if (trend === 'decreasing') {
      return (
        <Badge variant="success" size="sm" title="Tendencia a la baja - Menor demanda esperada">
          <HiArrowDown /> Disminuyendo
        </Badge>
      )
    }
    return (
      <Badge variant="info" size="sm" title="Tendencia estable">
        <HiArrowRight /> Estable
      </Badge>
    )
  }

  const ConfidenceBar = ({ value }) => {
    const conf = Math.round(value || 0)
    let variant = 'default'
    if (conf >= 80) variant = 'success'
    else if (conf >= 50) variant = 'warning'
    else variant = 'error'
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}>
        <div style={{ 
          flex: 1, 
          height: '8px', 
          backgroundColor: '#E5E7EB', 
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(100, conf)}%`,
            height: '100%',
            backgroundColor: 
              conf >= 80 ? '#10B981' : 
              conf >= 50 ? '#F59E0B' : 
              '#EF4444',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <Badge variant={variant} size="sm">{conf}%</Badge>
      </div>
    )
  }

  const columns = [
    {
      key: 'product_name',
      field: 'product_name',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('product_name')}
          title="Ordenar por nombre de producto"
        >
          Producto
          <SortIcon field="product_name" />
        </button>
      ),
      className: 'col-product',
      render: (value) => <strong>{value || 'Sin nombre'}</strong>
    },
    {
      key: 'predicted_quantity',
      field: 'predicted_quantity',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('predicted_quantity')}
          title="Cantidad predicha de consumo"
        >
          Predicción
          <SortIcon field="predicted_quantity" />
        </button>
      ),
      render: (value) => (
        <Badge variant="info" size="sm">
          {Math.round(value || 0).toLocaleString()} unidades
        </Badge>
      )
    },
    {
      key: 'current_stock',
      field: 'current_stock',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('current_stock')}
          title="Stock actual disponible"
        >
          Stock Actual
          <SortIcon field="current_stock" />
        </button>
      ),
      render: (value) => (
        <Badge variant={value > 0 ? 'success' : 'error'} size="sm">
          {Math.round(value || 0).toLocaleString()}
        </Badge>
      )
    },
    {
      key: 'coverage_percent',
      field: 'coverage_percent',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('coverage_percent')}
          title="Porcentaje de cobertura: (Stock Actual / Predicción) × 100"
        >
          % Cobertura
          <SortIcon field="coverage_percent" />
        </button>
      ),
      render: (_, row) => {
        const coverage = row.coverage_percent || 0
        let variant = 'success'
        if (coverage < 50) variant = 'error'
        else if (coverage < 80) variant = 'warning'
        
        return (
          <Badge variant={variant} size="sm">
            {coverage}%
          </Badge>
        )
      }
    },
    {
      key: 'deficit',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('deficit')}
          title="Cantidad faltante: Predicción - Stock Actual"
        >
          Déficit
          <SortIcon field="deficit" />
        </button>
      ),
      render: (_, row) => {
        const deficit = row.deficit || 0
        if (deficit <= 0) {
          return (
            <Badge variant="success" size="sm" title="Stock suficiente para cubrir la demanda">
              Suficiente
            </Badge>
          )
        }
        return (
          <Badge variant="error" size="sm" title={`Faltan ${deficit.toLocaleString()} unidades`}>
            {deficit.toLocaleString()} faltantes
          </Badge>
        )
      }
    },
    {
      key: 'recommended_stock',
      field: 'recommended_stock',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('recommended_stock')}
          title="Stock recomendado: Predicción + 20% margen de seguridad"
        >
          Stock Recomendado
          <SortIcon field="recommended_stock" />
        </button>
      ),
      render: (_, row) => {
        const recommended = row.recommended_stock || 0
        const current = row.current_stock || 0
        const needsMore = recommended > current
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <Badge variant={needsMore ? 'warning' : 'success'} size="sm">
              {recommended.toLocaleString()} unidades
            </Badge>
            {needsMore && (
              <span style={{ fontSize: '0.75rem', color: '#F59E0B' }}>
                +{Math.round(recommended - current).toLocaleString()} necesarias
              </span>
            )}
          </div>
        )
      }
    },
    {
      key: 'trend',
      field: 'trend',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('trend')}
          title="Tendencia de consumo comparada con período anterior"
        >
          Tendencia
          <SortIcon field="trend" />
        </button>
      ),
      render: (_, row) => <TrendIndicator trend={row.trend} />
    },
    {
      key: 'confidence_level',
      field: 'confidence_level',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('confidence_level')}
          title="Nivel de confianza de la predicción basado en datos históricos"
        >
          Confianza
          <SortIcon field="confidence_level" />
        </button>
      ),
      render: (value) => <ConfidenceBar value={value} />
    },
    {
      key: 'calculation_date',
      field: 'calculation_date',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('calculation_date')}
          title="Fecha de última actualización de la predicción"
        >
          Última Actualización
          <SortIcon field="calculation_date" />
        </button>
      ),
      render: (value) => {
        if (!value) return <span style={{ color: '#9CA3AF' }}>N/A</span>
        const date = new Date(value)
        return (
          <span style={{ fontSize: '0.875rem', color: '#6B7280' }}>
            {date.toLocaleDateString('es-ES', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric' 
            })}
          </span>
        )
      }
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'col-actions',
      render: (_, row) => (
        <div className="table-actions">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              setSelectedProduct(row)
              setShowDetail(true)
            }}
            title="Ver detalles completos de la predicción"
          >
            <HiEye />
            Detalles
          </Button>
          {canRegenerate && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => regenerateMutation.mutate(row.product_id)}
              loading={regenerateMutation.isPending}
              title="Regenerar predicción con datos actualizados"
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
          <div>
            <h3>Predicciones para el {getPeriodLabel(period)}</h3>
            <p className="table-subtitle">
              {sortedAndFilteredPredictions.length} de {predictions.length} predicciones mostradas
            </p>
          </div>
          <div className="table-header-actions">
            <div className="table-search">
              <HiSearch className="search-icon" />
              <Input
                type="text"
                placeholder="Buscar producto..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="table-search-input"
              />
            </div>
          </div>
        </div>
        {predictions.length === 0 ? (
          <div className="empty-state">
            <p>No hay predicciones disponibles para este período.</p>
            <p className="empty-hint">Genera predicciones para ver los resultados.</p>
          </div>
        ) : sortedAndFilteredPredictions.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron predicciones con los filtros aplicados.</p>
            {tableSearch && (
              <Button variant="outline" onClick={() => setTableSearch('')} className="mt-3">
                Limpiar búsqueda
              </Button>
            )}
          </div>
        ) : (
          <Table
            columns={columns}
            data={sortedAndFilteredPredictions}
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
