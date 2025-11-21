import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import UserForm from '../components/users/UserForm'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import { HiUsers, HiPlus, HiPencil, HiTrash } from 'react-icons/hi'
import './Users.css'

export default function Users() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users')
      return response.data.data || []
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/users/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
      setShowDelete(false)
      setSelectedUser(null)
    }
  })

  const handleCreate = () => {
    setSelectedUser(null)
    setShowForm(true)
  }

  const handleEdit = (user) => {
    setSelectedUser(user)
    setShowForm(true)
  }

  const handleDelete = (user) => {
    setSelectedUser(user)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    if (selectedUser) {
      deleteMutation.mutate(selectedUser.id)
    }
  }

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      farmaceutico: 'Químico Farmacéutico'
    }
    return labels[role] || role
  }

  const columns = [
    { key: 'id', field: 'id', header: 'ID', className: 'col-id' },
    { key: 'username', field: 'username', header: 'Usuario', className: 'col-username' },
    { 
      key: 'role', 
      field: 'role', 
      header: 'Rol',
      render: (value) => getRoleLabel(value)
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
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p className="page-subtitle">Administrar usuarios del sistema</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <HiPlus />
          Nuevo Usuario
        </Button>
      </div>

      <Card shadow="md" className="users-table-card">
        {isLoading ? (
          <Loading text="Cargando usuarios..." />
        ) : (
          <Table
            columns={columns}
            data={users || []}
            emptyMessage="No hay usuarios. Crea un nuevo usuario para comenzar."
          />
        )}
      </Card>

      {showForm && (
        <UserForm
          user={selectedUser}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedUser(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['users'])
          }}
        />
      )}

      {showDelete && selectedUser && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setSelectedUser(null)
          }}
          onConfirm={confirmDelete}
          itemName={selectedUser.username}
          loading={deleteMutation.isPending}
          message="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer."
        />
      )}
    </div>
  )
}

