import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Loading from '../components/common/Loading'
import Badge from '../components/common/Badge'
import { HiChartBar, HiDownload, HiPrinter } from 'react-icons/hi'
import './Reports.css'

export default function Reports() {
  const [reportType, setReportType] = useState('expired')
  const [days, setDays] = useState(30)
  const [exportFormat, setExportFormat] = useState('excel')
  const [exporting, setExporting] = useState(false)

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['report', reportType, days],
    queryFn: async () => {
      let endpoint = `/reports/${reportType}`
      const params = []
      if (reportType === 'expiring') {
        params.push(`days=${days}`)
      }
      if (reportType === 'consumption-by-area') {
        params.push(`days=${days}`)
      }
      if (params.length > 0) {
        endpoint += `?${params.join('&')}`
      }
      const response = await api.get(endpoint)
      return response.data.data || []
    }
  })

  const getReportTitle = () => {
    const titles = {
      expired: 'Medicamentos Vencidos',
      expiring: `Medicamentos por Vencer (Próximos ${days} días)`,
      'low-stock': 'Medicamentos con Stock Bajo',
      'consumption-by-area': `Consumo por Área (Últimos ${days} días)`,
      predictions: 'Predicciones de Consumo'
    }
    return titles[reportType] || 'Reporte'
  }

  const getColumns = () => {
    if (reportType === 'expired' || reportType === 'expiring') {
      return [
        { key: 'product_name', field: 'product_name', header: 'Medicamento' },
        { key: 'lot_number', field: 'lot_number', header: 'Lote' },
        { key: 'quantity', field: 'quantity', header: 'Cantidad' },
        { 
          key: 'expiry_date', 
          field: 'expiry_date', 
          header: 'Fecha Vencimiento',
          render: (value) => new Date(value).toLocaleDateString('es-ES')
        },
        {
          key: 'days_to_expiry',
          field: 'days_to_expiry',
          header: 'Días',
          render: (value) => {
            if (value < 0) return <Badge variant="error">Vencido</Badge>
            if (value <= 7) return <Badge variant="error">{value} días</Badge>
            if (value <= 30) return <Badge variant="warning">{value} días</Badge>
            return <Badge variant="success">{value} días</Badge>
          }
        }
      ]
    }
    if (reportType === 'low-stock') {
      return [
        { key: 'name', field: 'name', header: 'Medicamento' },
        { key: 'current_stock', field: 'current_stock', header: 'Stock Actual' },
        { key: 'min_stock', field: 'min_stock', header: 'Stock Mínimo' },
        {
          key: 'status',
          header: 'Estado',
          render: (_, row) => {
            const deficit = (row.min_stock || 0) - (row.current_stock || 0)
            if (deficit > 0) {
              return <Badge variant="error">{deficit} unidades faltantes</Badge>
            }
            return <Badge variant="warning">En el límite</Badge>
          }
        }
      ]
    }
    if (reportType === 'consumption-by-area') {
      return [
        { key: 'area_name', field: 'area_name', header: 'Área' },
        { key: 'total_removals', field: 'total_removals', header: 'Total Salidas' },
        { key: 'total_consumed', field: 'total_consumed', header: 'Total Consumido' },
        { key: 'unique_products', field: 'unique_products', header: 'Medicamentos Únicos' }
      ]
    }
    if (reportType === 'predictions') {
      return [
        { key: 'product_name', field: 'product_name', header: 'Medicamento' },
        { key: 'current_stock', field: 'current_stock', header: 'Stock Actual' },
        { key: 'predicted_quantity', field: 'predicted_quantity', header: 'Predicción' },
        {
          key: 'deficit',
          header: 'Déficit',
          render: (_, row) => {
            const deficit = (row.predicted_quantity || 0) - (row.current_stock || 0)
            if (deficit > 0) {
              return <Badge variant="error">{deficit} unidades</Badge>
            }
            return <Badge variant="success">Suficiente</Badge>
          }
        },
        {
          key: 'confidence_level',
          field: 'confidence_level',
          header: 'Confianza',
          render: (value) => {
            const level = parseFloat(value) || 0
            if (level >= 0.8) return <Badge variant="success">{Math.round(level * 100)}%</Badge>
            if (level >= 0.6) return <Badge variant="warning">{Math.round(level * 100)}%</Badge>
            return <Badge variant="error">{Math.round(level * 100)}%</Badge>
          }
        }
      ]
    }
    return []
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      params.append('report', reportType)
      if (reportType === 'expiring' || reportType === 'consumption-by-area') {
        params.append('days', days.toString())
      }
      
      // Use relative URL since api uses '/api' as baseURL
      const url = `/api/reports/export/${exportFormat}?${params.toString()}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Error al exportar el reporte')
      }
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      
      const reportName = getReportTitle().replace(/\s+/g, '_')
      const extension = exportFormat === 'excel' ? 'xlsx' : exportFormat
      link.download = `${reportName}.${extension}`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Error al exportar:', error)
      alert('Error al exportar el reporte. Por favor, intente nuevamente.')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p className="page-subtitle">Generar y visualizar reportes del sistema</p>
        </div>
        <div className="report-actions">
          <div className="export-format-selector">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="format-select"
              disabled={exporting}
            >
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <Button 
            variant="secondary" 
            onClick={handleExport}
            loading={exporting}
            disabled={exporting}
          >
            <HiDownload />
            Exportar
          </Button>
          <Button variant="secondary" onClick={handlePrint}>
            <HiPrinter />
            Imprimir
          </Button>
        </div>
      </div>

      <Card shadow="md">
        <div className="report-filters">
          <div className="filter-group">
            <label>Tipo de Reporte:</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="filter-select"
            >
              <option value="expired">Medicamentos Vencidos</option>
              <option value="expiring">Medicamentos por Vencer</option>
              <option value="low-stock">Stock Bajo</option>
              <option value="consumption-by-area">Consumo por Área</option>
              <option value="predictions">Predicciones de Consumo</option>
            </select>
          </div>
          {(reportType === 'expiring' || reportType === 'consumption-by-area') && (
            <div className="filter-group">
              <label>Días:</label>
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 30)}
                min={1}
                max={365}
              />
            </div>
          )}
          <Button variant="primary" onClick={() => refetch()}>
            <HiChartBar />
            Generar Reporte
          </Button>
        </div>
      </Card>

      <Card shadow="md" className="report-table-card">
        <div className="report-header">
          <h3>{getReportTitle()}</h3>
          <p className="report-count">
            {reportData?.length || 0} {reportData?.length === 1 ? 'registro' : 'registros'}
          </p>
        </div>
        {isLoading ? (
          <Loading text="Generando reporte..." />
        ) : (
          <Table
            columns={getColumns()}
            data={reportData || []}
            emptyMessage="No hay datos para este reporte"
          />
        )}
      </Card>
    </div>
  )
}

