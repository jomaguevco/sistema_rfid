import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import api from '../../services/api'
import Card from '../common/Card'
import Loading from '../common/Loading'
import './ConsumptionChart.css'

const COLORS = [
  'url(#colorGradient1)',
  'url(#colorGradient2)',
  'url(#colorGradient3)',
  'url(#colorGradient4)',
  'url(#colorGradient5)'
]

const SOLID_COLORS = ['#0066CC', '#0052A3', '#3B82F6', '#60A5FA', '#93C5FD']

export default function ConsumptionChart({ days = 30 }) {
  const { data, isLoading } = useQuery({
    queryKey: ['consumption-by-area', days],
    queryFn: async () => {
      const response = await api.get(`/dashboard/consumption-by-area?days=${days}`)
      return response.data.data || []
    }
  })

  if (isLoading) {
    return (
      <Card shadow="md">
        <Loading text="Cargando datos de consumo..." />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card shadow="md" title="Consumo por Área">
        <p className="empty-message">No hay datos de consumo disponibles</p>
      </Card>
    )
  }

  return (
    <Card shadow="md" title="Consumo por Área" className="chart-card">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <defs>
            <linearGradient id="colorGradient1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0066CC" stopOpacity={1} />
              <stop offset="100%" stopColor="#004C99" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="colorGradient2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0052A3" stopOpacity={1} />
              <stop offset="100%" stopColor="#003D7A" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="colorGradient3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="colorGradient4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60A5FA" stopOpacity={1} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="colorGradient5" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity={1} />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
          <XAxis 
            dataKey="area_name" 
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
            formatter={(value) => [value.toLocaleString(), 'Unidades Consumidas']}
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
            iconType="rect"
          />
          <Bar 
            dataKey="total_consumed" 
            name="Unidades Consumidas"
            radius={[8, 8, 0, 0]}
            animationDuration={800}
            animationBegin={0}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={SOLID_COLORS[index % SOLID_COLORS.length]}
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 102, 204, 0.3))' }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

