import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Card from '../common/Card'
import Loading from '../common/Loading'
import './PredictionsCharts.css'

const COLORS = ['#0066CC', '#004C99', '#0052A3', '#3B82F6', '#60A5FA']

export default function PredictionsCharts({ predictions, period }) {
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
  const stockVsPrediction = predictions
    .map(p => ({
      name: p.product_name || 'Sin nombre',
      stock: p.current_stock || 0,
      prediccion: Math.round(p.predicted_quantity || 0)
    }))
    .sort((a, b) => (b.prediccion - b.stock) - (a.prediccion - a.stock))
    .slice(0, 15)

  // Preparar datos para gráfico de confianza
  const confidenceData = [
    {
      name: 'Alta (80-100%)',
      value: predictions.filter(p => (p.confidence_level || 0) >= 80).length
    },
    {
      name: 'Media (50-79%)',
      value: predictions.filter(p => (p.confidence_level || 0) >= 50 && (p.confidence_level || 0) < 80).length
    },
    {
      name: 'Baja (<50%)',
      value: predictions.filter(p => (p.confidence_level || 0) < 50).length
    }
  ]

  // Preparar datos para gráfico de déficit
  const deficitData = predictions
    .map(p => {
      const deficit = (p.predicted_quantity || 0) - (p.current_stock || 0)
      return {
        name: p.product_name || 'Sin nombre',
        deficit: deficit > 0 ? Math.round(deficit) : 0
      }
    })
    .filter(d => d.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 10)

  return (
    <div className="predictions-charts">
      <div className="charts-grid">
        <Card shadow="md" title="Stock Actual vs Predicción" className="chart-card">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stockVsPrediction}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value) => [value.toLocaleString(), 'Unidades']}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Bar dataKey="stock" fill="#28A745" name="Stock Actual" />
              <Bar dataKey="prediccion" fill="#0066CC" name="Predicción" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card shadow="md" title="Distribución de Confianza" className="chart-card">
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={confidenceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {confidenceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [value, 'Predicciones']}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {deficitData.length > 0 && (
        <Card shadow="md" title="Top 10 Productos con Mayor Déficit" className="chart-card">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={deficitData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis 
                dataKey="name" 
                type="category"
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip 
                formatter={(value) => [value.toLocaleString(), 'Unidades faltantes']}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Bar dataKey="deficit" fill="#DC3545" name="Déficit" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

