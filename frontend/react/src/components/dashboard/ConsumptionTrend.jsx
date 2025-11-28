import { useQuery } from '@tanstack/react-query'
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import api from '../../services/api'
import Card from '../common/Card'
import Loading from '../common/Loading'
import './ConsumptionTrend.css'

export default function ConsumptionTrend({ days = 30 }) {
  const { data, isLoading } = useQuery({
    queryKey: ['consumption-trend', days],
    queryFn: async () => {
      const response = await api.get(`/dashboard/consumption-trend?days=${days}`)
      return response.data.data || []
    }
  })

  if (isLoading) {
    return (
      <Card shadow="md">
        <Loading text="Cargando tendencia de consumo..." />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card shadow="md" title="Tendencia de Consumo">
        <p className="empty-message">No hay datos de consumo disponibles</p>
      </Card>
    )
  }

  const chartData = data.map(item => ({
    fecha: new Date(item.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    consumido: Math.round(item.total_consumed || 0),
    removals: Math.round(item.total_removals || 0)
  }))

  return (
    <Card shadow="md" title={`Tendencia de Consumo (Últimos ${days} días)`} className="chart-card">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0066CC" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#0066CC" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="fecha" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            stroke="#9CA3AF"
          />
          <YAxis 
            tick={{ fontSize: 11, fill: '#6B7280' }}
            stroke="#9CA3AF"
            label={{ value: 'Unidades', angle: -90, position: 'insideLeft', style: { fill: '#374151' } }}
          />
          <Tooltip 
            formatter={(value, name) => {
              const roundedValue = Math.round(value || 0)
              if (name === 'consumido') return [roundedValue.toLocaleString(), 'Unidades Consumidas']
              if (name === 'removals') return [roundedValue.toLocaleString(), 'Retiros']
              return [roundedValue.toLocaleString(), name]
            }}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #E5E7EB', 
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              padding: '12px'
            }}
            labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '8px' }}
            itemStyle={{ color: '#0066CC', fontWeight: 500 }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Area 
            type="monotone" 
            dataKey="consumido" 
            stroke="#0066CC" 
            strokeWidth={3}
            fill="url(#areaGradient)"
            name="Unidades Consumidas"
            dot={{ fill: '#0066CC', r: 4, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#0052A3', stroke: '#fff', strokeWidth: 2 }}
            animationDuration={1000}
            animationBegin={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

