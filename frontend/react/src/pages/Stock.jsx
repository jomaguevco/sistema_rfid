import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { useRFID } from '../hooks/useRFID'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import Loading from '../components/common/Loading'
import StockDetailModal from '../components/products/StockDetailModal'
import { formatConcentration, formatRfidCode } from '../utils/formatting'
import { HiCube, HiWifi, HiStop, HiCollection } from 'react-icons/hi'
import './Stock.css'

// Hook personalizado para debounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function Stock() {
  const { hasAnyRole } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [showStockDetail, setShowStockDetail] = useState(false)
  const [selectedRfidCode, setSelectedRfidCode] = useState(null)
  const [filters, setFilters] = useState({
    category: '',
    product_type: ''
  })

  // Verificar que solo admin y químicos puedan acceder
  if (!hasAnyRole(['admin', 'farmaceutico'])) {
    return null // ProtectedRoute manejará la redirección
  }

  // Debounce del search query con 500ms de delay
  const debouncedQuery = useDebounce(searchQuery, 500)

  useEffect(() => {
    setDebouncedSearchQuery(debouncedQuery)
  }, [debouncedQuery])

  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ['stock', debouncedSearchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      // Usar el endpoint /products que agrupa por RFID
      if (debouncedSearchQuery.trim()) {
        params.append('search', debouncedSearchQuery.trim())
      }
      
      if (filters.category) params.append('category_id', filters.category)
      if (filters.product_type) params.append('product_type', filters.product_type)
      
      // Siempre agregar límite para evitar cargar demasiados datos
      params.append('limit', '100')
      
      const queryString = params.toString()
      const url = `/products?${queryString}`
      
      try {
        const response = await api.get(url)
        // La respuesta viene en formato paginado
        if (response.data.data) {
          return response.data.data
        }
        return []
      } catch (err) {
        console.error('❌ Error al obtener stock:', err)
        throw err
      }
    }
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const response = await api.get('/categories')
        return response.data.data || []
      } catch {
        return []
      }
    }
  })

  const { lastRFID, listening, startListening, stopListening } = useRFID({
    onDetect: (rfidUid) => {
      setSearchQuery(rfidUid)
    }
  })

  const clearFilters = () => {
    setFilters({
      category: '',
      product_type: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  const handleViewStockDetail = (row) => {
    const rfid = row.rfid_code || row.batch_rfid_uid || row.rfid_uid
    if (rfid && rfid !== '-') {
      setSelectedRfidCode(rfid)
      setShowStockDetail(true)
    }
  }

  const columns = [
    {
      key: 'rfid_code',
      header: 'Código RFID',
      className: 'col-rfid',
      render: (_, row) => {
        const rfid = row.rfid_code || row.batch_rfid_uid || row.rfid_uid || '-'
        const formattedRfid = formatRfidCode(rfid)
        const isEmpty = formattedRfid === '-'
        return (
          <span className={`rfid-code-container ${isEmpty ? 'empty' : ''}`}>
            <span className="rfid-code">{formattedRfid}</span>
          </span>
        )
      }
    },
    {
      key: 'name',
      field: 'name',
      header: 'Nombre del Medicamento',
      className: 'col-name'
    },
    {
      key: 'active_ingredient',
      field: 'active_ingredient',
      header: 'Principio Activo',
      className: 'col-active-ingredient',
      render: (value) => value || '-'
    },
    {
      key: 'concentration',
      field: 'concentration',
      header: 'Concentración',
      className: 'col-concentration',
      render: (value, row) => {
        const formatted = formatConcentration(value, row.product_type)
        return formatted !== '-' ? formatted : '-'
      }
    },
    {
      key: 'presentation',
      field: 'presentation',
      header: 'Presentación',
      className: 'col-presentation',
      render: (value) => value || '-'
    },
    {
      key: 'total_stock',
      field: 'total_stock',
      header: 'Stock',
      className: 'col-stock',
      render: (value) => (
        <Badge variant={value > 0 ? 'success' : 'error'} size="sm">
          {value || 0}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'col-actions',
      render: (_, row) => {
        const rfid = row.rfid_code || row.batch_rfid_uid || row.rfid_uid
        const hasRfid = rfid && rfid !== '-'
        
        return (
          <div className="table-actions">
            {hasRfid && (
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => handleViewStockDetail(row)}
                title="Ver stock detallado de todos los lotes con este RFID"
              >
                <HiCollection />
                Stock
              </Button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <div className="stock-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Stock</h1>
          <p className="page-subtitle">Ver stock de medicamentos agrupados por RFID</p>
        </div>
      </div>

      <Card shadow="md">
        <div className="search-section">
          <div className="search-bar">
            <Input
              placeholder="Buscar por RFID, nombre o principio activo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="filter-select"
              style={{ minWidth: '200px' }}
            >
              <option value="">Todas las categorías</option>
              {categories && categories.length > 0 ? (
                categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))
              ) : (
                <option disabled>No hay categorías disponibles</option>
              )}
            </select>
            <select
              value={filters.product_type}
              onChange={(e) => setFilters({ ...filters, product_type: e.target.value })}
              className="filter-select"
            >
              <option value="">Todos los tipos</option>
              <option value="medicamento">Medicamento</option>
              <option value="insumo">Insumo</option>
            </select>
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Limpiar Filtros
              </Button>
            )}
            <Button
              variant={listening ? 'danger' : 'secondary'}
              onClick={listening ? stopListening : startListening}
            >
              {listening ? <HiStop /> : <HiWifi />}
              {listening ? 'Detener' : 'RFID'}
            </Button>
          </div>
          {listening && (
            <div className="rfid-status">
              <span className="rfid-indicator pulse"></span>
              <span>Detección por proximidad activa</span>
              {lastRFID && (
                <span className="last-rfid">Tag detectado: {lastRFID.uid}</span>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card shadow="md" className="stock-table-card">
        {isLoading ? (
          <Loading text="Cargando stock..." />
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
              Error al cargar stock: {error.response?.data?.error || error.message}
            </p>
            <Button variant="primary" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={products || []}
            emptyMessage="No se encontraron productos en stock"
          />
        )}
      </Card>

      {showStockDetail && selectedRfidCode && (
        <StockDetailModal
          rfidCode={selectedRfidCode}
          isOpen={showStockDetail}
          onClose={() => {
            setShowStockDetail(false)
            setSelectedRfidCode(null)
          }}
        />
      )}
    </div>
  )
}

