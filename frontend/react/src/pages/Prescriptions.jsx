import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import Modal from '../components/common/Modal'
import Loading from '../components/common/Loading'
import { HiSearch, HiPlus, HiWifi, HiStop, HiClipboardList, HiEye, HiPrinter, HiX, HiFilter } from 'react-icons/hi'
import PrescriptionDetail from '../components/prescriptions/PrescriptionDetail'
import PrescriptionForm from '../components/prescriptions/PrescriptionForm'
import DispenseModal from '../components/prescriptions/DispenseModal'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import './Prescriptions.css'

export default function Prescriptions() {
  const { canPerformAction } = useAuth()
  const queryClient = useQueryClient()
  const [searchCode, setSearchCode] = useState('')
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showDispense, setShowDispense] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    date_from: '',
    date_to: '',
    doctor_name: '',
    patient_name: ''
  })
  const canCreate = canPerformAction('prescriptions', 'create')
  const canCancel = canPerformAction('prescriptions', 'update')

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['prescriptions', searchCode, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      // Búsqueda dinámica por código
      if (searchCode.trim()) {
        params.append('prescription_code', searchCode.trim())
      }
      
      if (filters.status) params.append('status', filters.status)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      if (filters.doctor_name) params.append('doctor_name', filters.doctor_name)
      if (filters.patient_name) params.append('patient_name', filters.patient_name)
      
      const queryString = params.toString()
      const url = queryString 
        ? `/prescriptions?limit=100&${queryString}`
        : '/prescriptions?limit=100'
      
      const response = await api.get(url)
      return response.data.data || []
    }
  })

  const clearFilters = () => {
    setFilters({
      status: '',
      date_from: '',
      date_to: '',
      doctor_name: '',
      patient_name: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')


  const columns = [
    {
      key: 'prescription_code',
      field: 'prescription_code',
      header: 'Código',
      className: 'col-code'
    },
    {
      key: 'patient_name',
      field: 'patient_name',
      header: 'Paciente'
    },
    {
      key: 'doctor_name',
      field: 'doctor_name',
      header: 'Médico'
    },
    {
      key: 'prescription_date',
      field: 'prescription_date',
      header: 'Fecha',
      render: (value) => new Date(value).toLocaleDateString('es-ES')
    },
    {
      key: 'status',
      field: 'status',
      header: 'Estado',
      render: (value) => {
        const variants = {
          pending: 'pending',
          partial: 'partial',
          fulfilled: 'completed',
          cancelled: 'error'
        }
        const labels = {
          pending: 'Pendiente',
          partial: 'Parcial',
          fulfilled: 'Completo',
          cancelled: 'Cancelado'
        }
        return <Badge variant={variants[value] || 'default'}>{labels[value] || value}</Badge>
      }
    },
    {
      key: 'items_count',
      field: 'items_count',
      header: 'Items',
      render: (value) => value || 0
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="table-actions">
          <Button size="sm" variant="outline" onClick={() => handleView(row)}>
            <HiEye />
            Ver
          </Button>
          {row.status !== 'fulfilled' && row.status !== 'cancelled' && (
            <Button size="sm" variant="primary" onClick={() => handleDispense(row)}>
              Despachar
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => handlePrint(row)}>
            <HiPrinter />
            Imprimir
          </Button>
          {row.status !== 'fulfilled' && row.status !== 'cancelled' && canCancel && (
            <Button size="sm" variant="danger" onClick={() => handleCancel(row)}>
              <HiX />
              Cancelar
            </Button>
          )}
        </div>
      )
    }
  ]

  const handleView = (prescription) => {
    setSelectedPrescription(prescription)
    setShowDetail(true)
  }

  const handleDispense = (prescription) => {
    setSelectedPrescription(prescription)
    setShowDispense(true)
  }

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.put(`/prescriptions/${id}`, { status: 'cancelled' })
      // Usar mensaje del backend si está disponible
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription'])
      setShowCancel(false)
      setSelectedPrescription(null)
      // Opcional: mostrar mensaje de éxito del backend
      if (data?.message) {
        console.log('✅', data.message)
      }
    },
    onError: (error) => {
      console.error('❌ Error al cancelar receta:', error.response?.data?.error || error.message)
    }
  })

  const handleCreate = () => {
    setShowCreate(true)
  }

  const handleCancel = (prescription) => {
    setSelectedPrescription(prescription)
    setShowCancel(true)
  }

  const confirmCancel = () => {
    if (selectedPrescription) {
      cancelMutation.mutate(selectedPrescription.id)
    }
  }

  const handlePrint = (prescription) => {
    // Implementar impresión de receta
    window.print()
  }

  return (
    <div className="prescriptions-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Recetas</h1>
          <p className="page-subtitle">Crear, buscar y despachar recetas médicas</p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={handleCreate}>
            <HiPlus />
            Nueva Receta
          </Button>
        )}
      </div>

      <Card shadow="md">
        <div className="search-section">
          <div className="search-bar">
            <Input
              placeholder="Buscar por código de receta..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
            />
            <Button 
              variant={showFilters ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <HiFilter />
              Filtros
            </Button>
          </div>
          {showFilters && (
            <div className="filters-panel">
              <div className="filters-grid">
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="input"
                  >
                    <option value="">Todos los estados</option>
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                    <option value="fulfilled">Completo</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha Desde</label>
                  <Input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Hasta</label>
                  <Input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Médico</label>
                  <Input
                    placeholder="Nombre del médico..."
                    value={filters.doctor_name}
                    onChange={(e) => setFilters({ ...filters, doctor_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Paciente</label>
                  <Input
                    placeholder="Nombre del paciente..."
                    value={filters.patient_name}
                    onChange={(e) => setFilters({ ...filters, patient_name: e.target.value })}
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <div className="filters-actions">
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Limpiar Filtros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card shadow="md" className="prescriptions-table-card">
        {isLoading ? (
          <Loading text="Cargando recetas..." />
        ) : (
          <Table
            columns={columns}
            data={prescriptions || []}
            emptyMessage="No se encontraron recetas"
          />
        )}
      </Card>

      {showDetail && selectedPrescription && (
        <PrescriptionDetail
          prescription={selectedPrescription}
          isOpen={showDetail}
          onClose={() => {
            setShowDetail(false)
            setSelectedPrescription(null)
          }}
        />
      )}

      {showCreate && (
        <PrescriptionForm
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['prescriptions'])
          }}
        />
      )}

      {showDispense && selectedPrescription && (
        <DispenseModal
          prescription={selectedPrescription}
          isOpen={showDispense}
          onClose={() => {
            setShowDispense(false)
            setSelectedPrescription(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['prescriptions'])
            setShowDispense(false)
            setSelectedPrescription(null)
          }}
        />
      )}

      {showCancel && selectedPrescription && (
        <DeleteConfirmModal
          isOpen={showCancel}
          onClose={() => {
            setShowCancel(false)
            setSelectedPrescription(null)
          }}
          onConfirm={confirmCancel}
          title="Cancelar Receta"
          itemName={`Receta ${selectedPrescription.prescription_code}`}
          loading={cancelMutation.isPending}
          message="¿Estás seguro de que deseas cancelar esta receta? Esta acción no se puede deshacer."
        />
      )}
    </div>
  )
}
