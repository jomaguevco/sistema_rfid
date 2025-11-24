import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import Loading from '../components/common/Loading'
import ProductForm from '../components/products/ProductForm'
import ProductDetail from '../components/products/ProductDetail'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import { formatConcentration } from '../utils/formatting'
import { HiCube, HiEye, HiPencil, HiTrash } from 'react-icons/hi'
import './Products.css'

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

export default function Products() {
  const { canPerformAction, hasRole } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [filters, setFilters] = useState({
    category: '',
    product_type: ''
  })
  const canEdit = canPerformAction('products', 'update')
  const canDelete = canPerformAction('products', 'delete')
  const canCreate = canPerformAction('products', 'create')

  // Verificar que solo admin pueda acceder
  if (!hasRole('admin')) {
    return <Navigate to="/dashboard" replace />
  }

  // Debounce del search query con 500ms de delay
  const debouncedQuery = useDebounce(searchQuery, 500)

  useEffect(() => {
    setDebouncedSearchQuery(debouncedQuery)
  }, [debouncedQuery])

  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ['products-catalog', debouncedSearchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      // Usar el endpoint /products/catalog para catálogo sin agrupar
      if (debouncedSearchQuery.trim()) {
        params.append('search', debouncedSearchQuery.trim())
      }
      
      if (filters.category) params.append('category_id', filters.category)
      if (filters.product_type) params.append('product_type', filters.product_type)
      
      // Siempre agregar límite para evitar cargar demasiados datos
      params.append('limit', '100')
      
      const queryString = params.toString()
      const url = `/products/catalog?${queryString}`
      
      try {
        const response = await api.get(url)
        // La respuesta viene en formato paginado
        if (response.data.data) {
          return response.data.data
        }
        return []
      } catch (err) {
        console.error('❌ Error al obtener catálogo de productos:', err)
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

  const clearFilters = () => {
    setFilters({
      category: '',
      product_type: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/products/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['products'])
      setShowDelete(false)
      setSelectedProduct(null)
    }
  })

  const handleCreate = () => {
    setSelectedProduct(null)
    setShowForm(true)
  }

  const handleView = (product) => {
    setSelectedProduct(product)
    setShowDetail(true)
  }

  const handleEdit = (product) => {
    setSelectedProduct(product)
    setShowForm(true)
  }

  const handleDelete = (product) => {
    setSelectedProduct(product)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    if (selectedProduct) {
      deleteMutation.mutate(selectedProduct.id)
    }
  }

  const handleViewStockDetail = (row) => {
    // Usar rfid_uid como campo principal (estandarizado)
    // rfid_code es solo para display formateado
    const rfid = row.rfid_uid || row.rfid_code || null
    if (rfid && rfid !== '-') {
      setSelectedRfidCode(rfid)
      setShowStockDetail(true)
    }
  }

  const columns = [
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
      render: (value, row) => {
        if (!value && !row.units_per_package) return '-'
        const presentation = value || ''
        const units = row.units_per_package || 1
        if (units > 1) {
          return `${presentation} (${units} por caja)`
        }
        return presentation || 'Unidad individual'
      }
    },
    {
      key: 'product_type',
      field: 'product_type',
      header: 'Tipo',
      className: 'col-type',
      render: (value) => (
        <Badge variant={value === 'medicamento' ? 'primary' : 'info'} size="sm">
          {value === 'medicamento' ? 'Medicamento' : 'Insumo'}
        </Badge>
      )
    },
    {
      key: 'category_name',
      field: 'category_name',
      header: 'Categoría',
      className: 'col-category',
      render: (value) => value || '-'
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'col-actions',
      render: (_, row) => (
        <div className="table-actions">
          <Button size="sm" variant="outline" onClick={() => handleView(row)}>
            <HiEye />
            Ver Detalles
          </Button>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => handleEdit(row)}>
              <HiPencil />
              Editar
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
              <HiTrash />
              Eliminar
            </Button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h1>Catálogo de Medicamentos</h1>
          <p className="page-subtitle">Gestionar catálogo de medicamentos e insumos médicos</p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={handleCreate}>
            <HiCube />
            Nuevo Medicamento
          </Button>
        )}
      </div>

      <Card shadow="md">
        <div className="search-section">
          <div className="search-bar">
            <Input
              placeholder="Buscar por nombre, principio activo o descripción..."
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
          </div>
        </div>
      </Card>

      <Card shadow="md" className="products-table-card">
        {isLoading ? (
          <Loading text="Cargando medicamentos..." />
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
              Error al cargar medicamentos: {error.response?.data?.error || error.message}
            </p>
            <Button variant="primary" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={products || []}
            emptyMessage="No se encontraron medicamentos"
          />
        )}
      </Card>

      {showForm && (
        <ProductForm
          product={selectedProduct}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedProduct(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['products'])
          }}
        />
      )}

      {showDetail && selectedProduct && (
        <ProductDetail
          productId={selectedProduct.id}
          isOpen={showDetail}
          onClose={() => {
            setShowDetail(false)
            setSelectedProduct(null)
          }}
        />
      )}

      {showDelete && selectedProduct && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setSelectedProduct(null)
          }}
          onConfirm={confirmDelete}
          itemName={selectedProduct.name}
          loading={deleteMutation.isPending}
          message="¿Estás seguro de que deseas eliminar este medicamento? Esta acción no se puede deshacer y afectará todos los lotes asociados."
        />
      )}
    </div>
  )
}
