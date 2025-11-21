import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import AreaForm from '../components/areas/AreaForm'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import { HiOfficeBuilding, HiPlus, HiPencil, HiTrash } from 'react-icons/hi'
import './Areas.css'

export default function Areas() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedArea, setSelectedArea] = useState(null)

  const { data: areas, isLoading } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      const response = await api.get('/areas')
      return response.data.data || []
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/areas/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['areas'])
      setShowDelete(false)
      setSelectedArea(null)
    }
  })

  const handleCreate = () => {
    setSelectedArea(null)
    setShowForm(true)
  }

  const handleEdit = (area) => {
    setSelectedArea(area)
    setShowForm(true)
  }

  const handleDelete = (area) => {
    setSelectedArea(area)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    if (selectedArea) {
      deleteMutation.mutate(selectedArea.id)
    }
  }

  const columns = [
    { key: 'id', field: 'id', header: 'ID', className: 'col-id' },
    { key: 'name', field: 'name', header: 'Nombre', className: 'col-name' },
    { 
      key: 'description', 
      field: 'description', 
      header: 'Descripción',
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
    <div className="areas-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Áreas</h1>
          <p className="page-subtitle">Administrar áreas del hospital</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <HiPlus />
          Nueva Área
        </Button>
      </div>

      <Card shadow="md" className="areas-table-card">
        {isLoading ? (
          <Loading text="Cargando áreas..." />
        ) : (
          <Table
            columns={columns}
            data={areas || []}
            emptyMessage="No hay áreas. Crea una nueva área para comenzar."
          />
        )}
      </Card>

      {showForm && (
        <AreaForm
          area={selectedArea}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedArea(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['areas'])
          }}
        />
      )}

      {showDelete && selectedArea && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setSelectedArea(null)
          }}
          onConfirm={confirmDelete}
          itemName={selectedArea.name}
          loading={deleteMutation.isPending}
          message="¿Estás seguro de que deseas eliminar esta área? Esta acción puede afectar el historial de consumo."
        />
      )}
    </div>
  )
}

