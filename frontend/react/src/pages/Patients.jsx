import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import PatientForm from '../components/patients/PatientForm'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import { HiUser, HiPlus, HiPencil, HiTrash } from 'react-icons/hi'
import './Patients.css'

export default function Patients() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: patients, isLoading, error } = useQuery({
    queryKey: ['patients', searchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (searchQuery.trim()) params.append('search', searchQuery.trim())
        
        const queryString = params.toString()
        const url = queryString ? `/patients?${queryString}` : '/patients'
        
        const response = await api.get(url)
        console.log('Respuesta de pacientes:', response.data)
        return response.data.data || []
      } catch (err) {
        console.error('Error al obtener pacientes:', err)
        console.error('Detalles del error:', err.response?.data)
        throw err
      }
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/patients/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['patients'])
      setShowDelete(false)
      setSelectedPatient(null)
    }
  })

  const handleCreate = () => {
    setSelectedPatient(null)
    setShowForm(true)
  }

  const handleEdit = (patient) => {
    setSelectedPatient(patient)
    setShowForm(true)
  }

  const handleDelete = (patient) => {
    setSelectedPatient(patient)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    if (selectedPatient) {
      deleteMutation.mutate(selectedPatient.id)
    }
  }

  const columns = [
    { key: 'name', field: 'name', header: 'Nombre', className: 'col-name' },
    { 
      key: 'id_number', 
      field: 'id_number', 
      header: 'DNI/ID',
      render: (value) => value || '-'
    },
    { 
      key: 'phone', 
      field: 'phone', 
      header: 'Teléfono',
      render: (value) => value || '-'
    },
    { 
      key: 'email', 
      field: 'email', 
      header: 'Email',
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
    <div className="patients-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Pacientes</h1>
          <p className="page-subtitle">Administrar pacientes del sistema</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <HiPlus />
          Nuevo Paciente
        </Button>
      </div>

      <Card shadow="md">
        <div className="search-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Buscar por nombre, DNI o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </Card>

      <Card shadow="md" className="patients-table-card">
        {isLoading ? (
          <Loading text="Cargando pacientes..." />
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
              Error al cargar pacientes: {error.response?.data?.error || error.message}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Recargar página
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={patients || []}
            emptyMessage="No hay pacientes. Crea un nuevo paciente para comenzar."
          />
        )}
      </Card>

      {showForm && (
        <PatientForm
          patient={selectedPatient}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedPatient(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['patients'])
          }}
        />
      )}

      {showDelete && selectedPatient && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setSelectedPatient(null)
          }}
          onConfirm={confirmDelete}
          itemName={selectedPatient.name}
          loading={deleteMutation.isPending}
          message="¿Estás seguro de que deseas eliminar este paciente? Esta acción no se puede deshacer."
        />
      )}
    </div>
  )
}

