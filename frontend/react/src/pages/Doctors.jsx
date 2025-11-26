import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import DoctorForm from '../components/doctors/DoctorForm'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import { HiUserGroup, HiPlus, HiPencil, HiTrash } from 'react-icons/hi'
import './Doctors.css'

export default function Doctors() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [areaFilter, setAreaFilter] = useState('')

  const { data: doctors, isLoading, error } = useQuery({
    queryKey: ['doctors', searchQuery, areaFilter],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (searchQuery.trim()) params.append('search', searchQuery.trim())
        if (areaFilter) params.append('area_id', areaFilter)
        
        const queryString = params.toString()
        const url = queryString ? `/doctors?${queryString}` : '/doctors'
        
        const response = await api.get(url)
        console.log('Respuesta de doctores:', response.data)
        return response.data.data || []
      } catch (err) {
        console.error('Error al obtener doctores:', err)
        console.error('Detalles del error:', err.response?.data)
        throw err
      }
    }
  })

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      try {
        const response = await api.get('/areas?all=true')
        return response.data.data || []
      } catch {
        return []
      }
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/doctors/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['doctors'])
      setShowDelete(false)
      setSelectedDoctor(null)
    }
  })

  const handleCreate = () => {
    setSelectedDoctor(null)
    setShowForm(true)
  }

  const handleEdit = (doctor) => {
    setSelectedDoctor(doctor)
    setShowForm(true)
  }

  const handleDelete = (doctor) => {
    setSelectedDoctor(doctor)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    if (selectedDoctor) {
      deleteMutation.mutate(selectedDoctor.id)
    }
  }

  const columns = [
    { key: 'name', field: 'name', header: 'Nombre', className: 'col-name' },
    { 
      key: 'user_username', 
      field: 'user_username', 
      header: 'Usuario',
      render: (value) => value ? (
        <span className="username-badge">{value}</span>
      ) : (
        <span className="no-user">Sin usuario</span>
      )
    },
    { 
      key: 'specialty', 
      field: 'specialty', 
      header: 'Especialidad',
      render: (value) => value || '-'
    },
    { 
      key: 'area_name', 
      field: 'area_name', 
      header: 'Área',
      render: (value) => value || 'Medicina General'
    },
    { 
      key: 'license_number', 
      field: 'license_number', 
      header: 'Colegiatura',
      render: (value) => value || '-'
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <div className="table-actions">
          <Button size="sm" variant="secondary" onClick={() => handleEdit(row)}>
            <HiPencil />
            Editar
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row)}>
            <HiTrash />
            Eliminar
          </Button>
        </div>
      )
    }
  ]

  return (
    <div className="doctors-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Doctores</h1>
          <p className="page-subtitle">Administrar doctores y médicos del sistema</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <HiPlus />
          Nuevo Doctor
        </Button>
      </div>

      <Card shadow="md">
        <div className="search-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Buscar por nombre, especialidad o colegiatura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
            />
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
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
        </div>
      </Card>

      <Card shadow="md" className="doctors-table-card">
        {isLoading ? (
          <Loading text="Cargando doctores..." />
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
              Error al cargar doctores: {error.response?.data?.error || error.message}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Recargar página
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={doctors || []}
            emptyMessage="No hay doctores. Crea un nuevo doctor para comenzar."
          />
        )}
      </Card>

      {showForm && (
        <DoctorForm
          doctor={selectedDoctor}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedDoctor(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['doctors'])
          }}
        />
      )}

      {showDelete && selectedDoctor && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setSelectedDoctor(null)
          }}
          onConfirm={confirmDelete}
          itemName={selectedDoctor.name}
          loading={deleteMutation.isPending}
          message="¿Estás seguro de que deseas eliminar este doctor? Esta acción no se puede deshacer."
        />
      )}
    </div>
  )
}

