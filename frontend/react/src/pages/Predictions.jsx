import { useState } from 'react'
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
import { HiChartBar, HiWifi, HiStop } from 'react-icons/hi'
import './Predictions.css'

export default function Predictions() {
  const { canPerformAction, hasRole } = useAuth()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('month')
  const [areaId, setAreaId] = useState('')
  const [viewMode, setViewMode] = useState('table')
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

  const { data: predictions, isLoading } = useQuery({
    queryKey: ['predictions', period, areaId],
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
              const productsResponse = await api.get('/products?limit=500')
              const products = productsResponse.data.data || []
              
              const predictionsList = []
              for (const product of products) {
                try {
                  const predResponse = await api.get(`/predictions/product/${product.id}`)
                  const productPredictions = predResponse.data.data || []
                  const prediction = productPredictions.find(p => p.prediction_period === period && !p.area_id)
                  if (prediction) {
                    predictionsList.push({
                      ...prediction,
                      product_name: product.name,
                      current_stock: product.total_stock || 0
                    })
                  }
                } catch {
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

  return (
    <div className="predictions-page">
      <div className="page-header">
        <div>
          <h1>Predicciones de Consumo</h1>
          <p className="page-subtitle">
            Análisis de consumo futuro basado en datos históricos
          </p>
        </div>
        {canGenerate && <GeneratePredictionsButton areaId={areaId ? parseInt(areaId) : null} />}
      </div>

      <Card shadow="md">
        <div className="predictions-filters">
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
      </Card>

      {isLoading ? (
        <Card shadow="md">
          <Loading text="Cargando predicciones..." />
        </Card>
      ) : viewMode === 'charts' ? (
        <PredictionsCharts predictions={predictions || []} period={period} />
      ) : (
        <PredictionsTable 
          predictions={predictions || []} 
          period={period}
          onRefresh={() => queryClient.invalidateQueries(['predictions'])}
        />
      )}
    </div>
  )
}

