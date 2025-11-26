import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import PharmacistForm from '../components/pharmacists/PharmacistForm'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import { HiBeaker, HiPlus, HiPencil, HiTrash } from 'react-icons/hi'
import './Pharmacists.css'

export default function Pharmacists() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedPharmacist, setSelectedPharmacist] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: pharmacists, isLoading, error } = useQuery({
    queryKey: ['pharmacists', searchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (searchQuery.trim()) params.append('search', searchQuery.trim())
        
        const queryString = params.toString()
        const url = queryString ? `/pharmacists?${queryString}` : '/pharmacists'
        
        const response = await api.get(url)
        console.log('Respuesta de químicos farmacéuticos:', response.data)
        return response.data.data || []
      } catch (err) {
        console.error('Error al obtener químicos farmacéuticos:', err)
        console.error('Detalles del error:', err.response?.data)
        throw err
      }
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/pharmacists/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['pharmacists'])
      setShowDelete(false)
      setSelectedPharmacist(null)
    }
  })

  const handleCreate = () => {
    setSelectedPharmacist(null)
    setShowForm(true)
  }

  const handleEdit = (pharmacist) => {
    setSelectedPharmacist(pharmacist)
    setShowForm(true)
  }

  const handleDelete = (pharmacist) => {
    setSelectedPharmacist(pharmacist)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    if (selectedPharmacist) {
      deleteMutation.mutate(selectedPharmacist.id)
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
      key: 'id_number', 
      field: 'id_number', 
      header: 'DNI',
      render: (value) => value || '-'
    },
    { 
      key: 'license_number', 
      field: 'license_number', 
      header: 'Número de Licencia',
      render: (value) => value || '-'
    },
    { 
      key: 'email', 
      field: 'email', 
      header: 'Email',
      render: (value) => value || '-'
    },
    { 
      key: 'phone', 
      field: 'phone', 
      header: 'Teléfono',
      render: (value) => value || '-'
    },
    {
      key: 'is_active',
      field: 'is_active',
      header: 'Estado',
      render: (value) => (
        <span className={`status-badge ${value ? 'active' : 'inactive'}`}>
          {value ? 'Activo' : 'Inactivo'}
        </span>
      )
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
    <div className="pharmacists-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Químicos Farmacéuticos</h1>
          <p className="page-subtitle">Administrar químicos farmacéuticos del sistema</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <HiPlus />
          Nuevo Químico
        </Button>
      </div>

      <Card shadow="md">
        <div className="search-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Buscar por nombre, DNI, licencia o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </Card>

      <Card shadow="md" className="pharmacists-table-card">
        {isLoading ? (
          <Loading text="Cargando químicos farmacéuticos..." />
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
              Error al cargar químicos farmacéuticos: {error.response?.data?.error || error.message}
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Recargar página
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={pharmacists || []}
            emptyMessage="No hay químicos farmacéuticos. Crea uno nuevo para comenzar."
          />
        )}
      </Card>

      {showForm && (
        <PharmacistForm
          pharmacist={selectedPharmacist}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedPharmacist(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['pharmacists'])
          }}
        />
      )}

      {showDelete && selectedPharmacist && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setSelectedPharmacist(null)
          }}
          onConfirm={confirmDelete}
          itemName={selectedPharmacist.name}
          loading={deleteMutation.isPending}
          message="¿Estás seguro de que deseas eliminar este químico farmacéutico? Esta acción no se puede deshacer."
        />
      )}
    </div>
  )
}

