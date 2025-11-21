import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import api from '../../services/api'
import Card from '../common/Card'
import Loading from '../common/Loading'
import './CategoryDistribution.css'

const COLORS = [
  '#0066CC', '#0052A3', '#3B82F6', '#60A5FA', 
  '#93C5FD', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899'
]

export default function CategoryDistribution() {
  const { data, isLoading } = useQuery({
    queryKey: ['products-by-category'],
    queryFn: async () => {
      const response = await api.get('/dashboard/products-by-category')
      return response.data.data || []
    }
  })

  if (isLoading) {
    return (
      <Card shadow="md">
        <Loading text="Cargando distribución..." />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card shadow="md" title="Distribución por Categoría">
        <p className="empty-message">No hay categorías disponibles</p>
      </Card>
    )
  }

  const chartData = data.map(item => ({
    name: item.category_name || 'Sin categoría',
    value: item.product_count || 0,
    stock: item.total_stock || 0
  }))

  const RADIAN = Math.PI / 180
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
      </text>
    )
  }

  return (
    <Card shadow="md" title="Distribución por Categoría" className="chart-card">
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={110}
            innerRadius={40}
            fill="#8884d8"
            dataKey="value"
            animationDuration={800}
            animationBegin={0}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                  cursor: 'pointer'
                }}
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value, name, props) => [
              `${value} medicamentos`,
              props.payload.name
            ]}
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
            iconType="circle"
            formatter={(value, entry) => (
              <span style={{ color: '#374151', fontSize: '12px' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}

