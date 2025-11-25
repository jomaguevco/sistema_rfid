import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Card from '../common/Card'
import Table from '../common/Table'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Input from '../common/Input'
import Modal from '../common/Modal'
import PredictionDetailModal from './PredictionDetailModal'
import { HiRefresh, HiEye, HiSortAscending, HiSortDescending, HiSearch } from 'react-icons/hi'
import './PredictionsTable.css'

export default function PredictionsTable({ predictions, period, onRefresh }) {
  const queryClient = useQueryClient()
  const { canPerformAction } = useAuth()
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [sortField, setSortField] = useState('predicted_quantity')
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
      month: 'Mes',
      quarter: 'Trimestre',
      year: 'Año'
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

  const sortedAndFilteredPredictions = useMemo(() => {
    let filtered = [...predictions]
    
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
  }, [predictions, sortField, sortDirection, tableSearch])

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? <HiSortAscending /> : <HiSortDescending />
  }

  const columns = [
    {
      key: 'product_name',
      field: 'product_name',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('product_name')}
        >
          Medicamento
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
        >
          Stock Actual
          <SortIcon field="current_stock" />
        </button>
      ),
      render: (value) => (
        <Badge variant={value > 0 ? 'success' : 'error'} size="sm">
          {(value || 0).toLocaleString()}
        </Badge>
      )
    },
    {
      key: 'deficit',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('deficit')}
        >
          Déficit
          <SortIcon field="deficit" />
        </button>
      ),
      render: (_, row) => {
        const deficit = (row.predicted_quantity || 0) - (row.current_stock || 0)
        if (deficit <= 0) return <Badge variant="success" size="sm">Suficiente</Badge>
        return <Badge variant="error" size="sm">{Math.round(deficit).toLocaleString()} faltantes</Badge>
      }
    },
    {
      key: 'confidence_level',
      field: 'confidence_level',
      header: (
        <button 
          className="table-header-sortable" 
          onClick={() => handleSort('confidence_level')}
        >
          Confianza
          <SortIcon field="confidence_level" />
        </button>
      ),
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
                placeholder="Buscar medicamento..."
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

