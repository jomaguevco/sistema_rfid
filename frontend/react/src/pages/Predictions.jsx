import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Loading from '../components/common/Loading'
import PredictionsTable from '../components/predictions/PredictionsTable'
import PredictionsCharts from '../components/predictions/PredictionsCharts'
import GeneratePredictionsButton from '../components/predictions/GeneratePredictionsButton'
import PredictionsKPICards from '../components/predictions/PredictionsKPICards'
import { HiChartBar, HiWifi, HiStop, HiFilter, HiX } from 'react-icons/hi'
import './Predictions.css'

export default function Predictions() {
  const { canPerformAction, hasRole } = useAuth()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('month')
  const [areaId, setAreaId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [productType, setProductType] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [showFilters, setShowFilters] = useState(false)
  const isAdmin = hasRole('admin')
  const canGenerate = isAdmin || canPerformAction('predictions', 'create')

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      try {
        const response = await api.get('/areas')
        return response.data.data || []
      } catch {
        return []
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

  const productTypes = [
    { value: '', label: 'Todos los tipos' },
    { value: 'medicamento', label: 'Medicamento' },
    { value: 'insumo', label: 'Insumo' },
    { value: 'dispositivo', label: 'Dispositivo Médico' },
    { value: 'vacuna', label: 'Vacuna' }
  ]

  const { data: predictions, isLoading } = useQuery({
    queryKey: ['predictions', period, areaId, categoryId, productType],
    queryFn: async () => {
      try {
        if (areaId) {
          const response = await api.get(`/predictions/by-area?period=${period}&area_id=${areaId}`)
          return response.data.data || []
        } else {
          // Obtener todas las predicciones del período (sin área específica)
          try {
            const response = await api.get(`/predictions/by-area?period=${period}`)
            const allPredictions = response.data.data || []
            
            // Si no hay predicciones, intentar obtener de productos individuales
            if (allPredictions.length === 0) {
              const filters = { limit: 500 }
              if (categoryId) filters.category_id = categoryId
              if (productType) filters.product_type = productType
              
              const queryParams = new URLSearchParams()
              Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value)
              })
              
              const productsResponse = await api.get(`/products?${queryParams.toString()}`)
              const products = productsResponse.data.data || []
              
              const predictionsList = []
              for (const product of products) {
                try {
                  const predResponse = await api.get(`/predictions/product/${product.id}`)
                  const productPredictions = predResponse.data.data || []
                  const prediction = productPredictions.find(p => p.prediction_period === period && !p.area_id)
                  if (prediction) {
                    // Asegurar que current_stock tenga un valor numérico válido
                    const stockValue = Number(product.total_stock) || 0
                    predictionsList.push({
                      ...prediction,
                      product_name: product.name,
                      product_id: product.id,
                      current_stock: isNaN(stockValue) ? 0 : stockValue,
                      category_id: product.category_id,
                      category_name: product.category_name,
                      product_type: product.product_type
                    })
                  }
                } catch (err) {
                  console.warn(`Error al obtener predicción para producto ${product.id}:`, err)
                  // Continuar si hay error
                }
              }
              return predictionsList
            }
            
            return allPredictions
          } catch {
            return []
          }
        }
      } catch (error) {
        console.error('Error al cargar predicciones:', error)
        return []
      }
    }
  })

  // Filtrar predicciones por término de búsqueda
  const filteredPredictions = useMemo(() => {
    if (!predictions) return []
    
    let filtered = [...predictions]
    
    // Filtrar por categoría si está seleccionada
    if (categoryId) {
      filtered = filtered.filter(p => p.category_id === parseInt(categoryId))
    }
    
    // Filtrar por tipo de producto si está seleccionado
    if (productType) {
      filtered = filtered.filter(p => p.product_type === productType)
    }
    
    // Filtrar por término de búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        (p.product_name || '').toLowerCase().includes(search)
      )
    }
    
    return filtered
  }, [predictions, categoryId, productType, searchTerm])

  const hasActiveFilters = categoryId || productType || searchTerm.trim()

  const clearFilters = () => {
    setCategoryId('')
    setProductType('')
    setSearchTerm('')
  }

  return (
    <div className="predictions-page">
      <div className="page-header">
        <div>
          <h1>Predicciones de Consumo</h1>
          <p className="page-subtitle">
            Análisis de consumo futuro basado en datos históricos y tendencias
          </p>
        </div>
        <div className="header-actions">
          <Button
            variant={showFilters ? "primary" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            size="md"
          >
            <HiFilter />
            {showFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}
          </Button>
          {canGenerate && <GeneratePredictionsButton areaId={areaId ? parseInt(areaId) : null} />}
        </div>
      </div>

      {/* Tarjetas KPI */}
      {!isLoading && filteredPredictions.length > 0 && (
        <PredictionsKPICards predictions={filteredPredictions} />
      )}

      <Card shadow="md">
        <div className="predictions-filters">
          <div className="filters-main">
            <div className="filter-group">
              <label>Período:</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="filter-select"
              >
                <option value="month">Próximo Mes</option>
                <option value="quarter">Próximo Trimestre</option>
                <option value="year">Próximo Año</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Área:</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="filter-select"
              >
                <option value="">Todas las áreas</option>
                {areas?.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Vista:</label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="filter-select"
              >
                <option value="table">Tabla</option>
                <option value="charts">Gráficos</option>
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="filters-advanced">
              <div className="filters-advanced-header">
                <h3>Filtros Avanzados</h3>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="clear-filters-btn"
                  >
                    <HiX />
                    Limpiar Filtros
                  </Button>
                )}
              </div>
              
              <div className="filters-advanced-content">
                <div className="filter-group">
                  <label>Buscar Medicamento:</label>
                  <Input
                    type="text"
                    placeholder="Nombre del medicamento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="filter-input"
                  />
                </div>

                <div className="filter-group">
                  <label>Categoría:</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Todas las categorías</option>
                    {categories?.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Tipo de Producto:</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="filter-select"
                  >
                    {productTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {isLoading ? (
        <Card shadow="md">
          <Loading text="Cargando predicciones..." />
        </Card>
      ) : filteredPredictions.length === 0 ? (
        <Card shadow="md">
          <div className="empty-state">
            <p>No hay predicciones disponibles para los filtros seleccionados.</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="mt-3">
                Limpiar filtros
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === 'charts' ? (
        <PredictionsCharts predictions={filteredPredictions} period={period} />
      ) : (
        <PredictionsTable 
          predictions={filteredPredictions} 
          period={period}
          onRefresh={() => queryClient.invalidateQueries(['predictions'])}
        />
      )}
    </div>
  )
}

