import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import Card from '../common/Card'
import Loading from '../common/Loading'
import Badge from '../common/Badge'
import { HiTrendingUp, HiTrendingDown, HiInformationCircle } from 'react-icons/hi'
import './PredictionsCharts.css'

const COLORS = ['#0066CC', '#004C99', '#0052A3', '#3B82F6', '#60A5FA', '#28A745', '#FFC107', '#DC3545']
const CONFIDENCE_COLORS = {
  high: '#28A745',
  medium: '#FFC107',
  low: '#DC3545'
}

export default function PredictionsCharts({ predictions, period }) {
  const [selectedChart, setSelectedChart] = useState('stock-vs-prediction')

  if (!predictions || predictions.length === 0) {
    return (
      <Card shadow="md">
        <div className="empty-state">
          <p>No hay predicciones para mostrar en gráficos</p>
        </div>
      </Card>
    )
  }

  // Preparar datos para gráfico de stock vs predicción
  const stockVsPrediction = useMemo(() => {
    return predictions
      .map(p => ({
        name: (p.product_name || 'Sin nombre').substring(0, 20),
        fullName: p.product_name || 'Sin nombre',
        stock: p.current_stock || 0,
        prediccion: Math.round(p.predicted_quantity || 0),
        deficit: Math.max(0, Math.round((p.predicted_quantity || 0) - (p.current_stock || 0))),
        confidence: Math.round(p.confidence_level || 0)
      }))
      .sort((a, b) => (b.prediccion - b.stock) - (a.prediccion - a.stock))
      .slice(0, 15)
  }, [predictions])

  // Preparar datos para gráfico de confianza
  const confidenceData = useMemo(() => {
    return [
      {
        name: 'Alta (80-100%)',
        value: predictions.filter(p => (p.confidence_level || 0) >= 80).length,
        color: CONFIDENCE_COLORS.high
      },
      {
        name: 'Media (50-79%)',
        value: predictions.filter(p => {
          const conf = p.confidence_level || 0
          return conf >= 50 && conf < 80
        }).length,
        color: CONFIDENCE_COLORS.medium
      },
      {
        name: 'Baja (<50%)',
        value: predictions.filter(p => (p.confidence_level || 0) < 50).length,
        color: CONFIDENCE_COLORS.low
      }
    ]
  }, [predictions])

  // Preparar datos para gráfico de déficit
  const deficitData = useMemo(() => {
    return predictions
      .map(p => {
        const deficit = (p.predicted_quantity || 0) - (p.current_stock || 0)
        return {
          name: (p.product_name || 'Sin nombre').substring(0, 20),
          fullName: p.product_name || 'Sin nombre',
          deficit: deficit > 0 ? Math.round(deficit) : 0,
          stock: p.current_stock || 0,
          predicted: Math.round(p.predicted_quantity || 0)
        }
      })
      .filter(d => d.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 10)
  }, [predictions])

  // Preparar datos para gráfico de tendencia de confianza
  const confidenceTrend = useMemo(() => {
    const sorted = [...predictions]
      .sort((a, b) => (a.confidence_level || 0) - (b.confidence_level || 0))
      .slice(0, 20)
    
    return sorted.map((p, index) => ({
      index: index + 1,
      name: (p.product_name || 'Sin nombre').substring(0, 15),
      confidence: Math.round(p.confidence_level || 0),
      predicted: Math.round(p.predicted_quantity || 0)
    }))
  }, [predictions])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value?.toLocaleString() || 0}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const chartOptions = [
    { id: 'stock-vs-prediction', label: 'Stock vs Predicción', icon: HiTrendingUp },
    { id: 'confidence', label: 'Confianza', icon: HiInformationCircle },
    { id: 'deficit', label: 'Déficit', icon: HiTrendingDown },
    { id: 'confidence-trend', label: 'Tendencia Confianza', icon: HiTrendingUp }
  ]

  return (
    <div className="predictions-charts">
      <Card shadow="md" className="chart-selector-card">
        <div className="chart-selector">
          {chartOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                className={`chart-selector-btn ${selectedChart === option.id ? 'active' : ''}`}
                onClick={() => setSelectedChart(option.id)}
              >
                <Icon />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="charts-grid">
        {selectedChart === 'stock-vs-prediction' && (
          <Card shadow="md" title="Stock Actual vs Predicción" className="chart-card">
            <div className="chart-info">
              <Badge variant="info">Top 15 productos con mayor diferencia</Badge>
            </div>
            <ResponsiveContainer width="100%" height={450}>
              <BarChart data={stockVsPrediction} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="stock" fill="#28A745" name="Stock Actual" radius={[4, 4, 0, 0]} />
                <Bar dataKey="prediccion" fill="#0066CC" name="Predicción" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {selectedChart === 'confidence' && (
          <Card shadow="md" title="Distribución de Confianza" className="chart-card">
            <div className="chart-info">
              <Badge variant="info">Nivel de confianza de las predicciones</Badge>
            </div>
            <ResponsiveContainer width="100%" height={450}>
              <PieChart>
                <Pie
                  data={confidenceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => 
                    value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : ''
                  }
                  outerRadius={140}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {confidenceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => [value, 'Predicciones']}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {selectedChart === 'deficit' && deficitData.length > 0 && (
          <Card shadow="md" title="Top 10 Productos con Mayor Déficit" className="chart-card">
            <div className="chart-info">
              <Badge variant="error">Productos que requieren reposición urgente</Badge>
            </div>
            <ResponsiveContainer width="100%" height={450}>
              <BarChart data={deficitData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  width={120}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}
                />
                <Legend />
                <Bar dataKey="deficit" fill="#DC3545" name="Déficit Estimado" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {selectedChart === 'confidence-trend' && (
          <Card shadow="md" title="Tendencia de Confianza" className="chart-card">
            <div className="chart-info">
              <Badge variant="info">Distribución de confianza por producto</Badge>
            </div>
            <ResponsiveContainer width="100%" height={450}>
              <AreaChart data={confidenceTrend} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <defs>
                  <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066CC" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0066CC" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="confidence" 
                  stroke="#0066CC" 
                  fillOpacity={1} 
                  fill="url(#colorConfidence)" 
                  name="Nivel de Confianza (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  )
}

