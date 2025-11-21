import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line } from 'recharts'
import api from '../../services/api'
import Card from '../common/Card'
import Loading from '../common/Loading'
import Button from '../common/Button'
import './ExpiryDistribution.css'

export default function ExpiryDistribution() {
  const [chartType, setChartType] = useState('bar') // 'bar', 'pie', 'line'

  const { data, isLoading } = useQuery({
    queryKey: ['expiry-distribution'],
    queryFn: async () => {
      const response = await api.get('/dashboard/expiry-distribution')
      return response.data.data || []
    }
  })

  if (isLoading) {
    return (
      <Card shadow="md">
        <Loading text="Cargando distribución de vencimientos..." />
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card shadow="md" title="Distribución de Vencimientos">
        <p className="empty-message">No hay datos de vencimientos disponibles</p>
      </Card>
    )
  }

  const getColor = (label) => {
    if (label === 'Vencidos') return '#EF4444'
    if (label.includes('0-7')) return '#F59E0B'
    if (label.includes('8-15')) return '#FBBF24'
    if (label.includes('16-30')) return '#3B82F6'
    if (label.includes('31-60')) return '#60A5FA'
    if (label.includes('61-90')) return '#93C5FD'
    return '#10B981'
  }

  // Preparar datos para gráfico de líneas temporal
  const lineData = data.map((entry, index) => ({
    ...entry,
    index,
    value: entry.total_quantity
  }))

  const renderChart = () => {
    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ range_label, percent }) => `${range_label}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="total_quantity"
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.range_label)} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [value.toLocaleString(), 'Unidades']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #E5E7EB', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  padding: '12px'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={lineData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
              <XAxis 
                dataKey="range_label" 
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
                formatter={(value) => [value.toLocaleString(), 'Unidades']}
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
              <Legend />
              <Line 
                type="monotone" 
                dataKey="total_quantity" 
                stroke="#0066CC" 
                strokeWidth={3}
                name="Unidades"
                dot={{ fill: '#0066CC', r: 5, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7, fill: '#0052A3', stroke: '#fff', strokeWidth: 2 }}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        )
      default:
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
              <XAxis 
                dataKey="range_label" 
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
                formatter={(value) => [value.toLocaleString(), 'Unidades']}
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
                dataKey="total_quantity" 
                name="Unidades"
                radius={[8, 8, 0, 0]}
                animationDuration={800}
                animationBegin={0}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getColor(entry.range_label)}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
    }
  }

  return (
    <Card shadow="md" title="Distribución de Vencimientos" className="chart-card">
      <div className="chart-controls">
        <Button 
          size="sm" 
          variant={chartType === 'bar' ? 'primary' : 'secondary'}
          onClick={() => setChartType('bar')}
        >
          Barras
        </Button>
        <Button 
          size="sm" 
          variant={chartType === 'pie' ? 'primary' : 'secondary'}
          onClick={() => setChartType('pie')}
        >
          Circular
        </Button>
        <Button 
          size="sm" 
          variant={chartType === 'line' ? 'primary' : 'secondary'}
          onClick={() => setChartType('line')}
        >
          Líneas
        </Button>
      </div>
      {renderChart()}
    </Card>
  )
}

