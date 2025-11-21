import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import Card from '../components/common/Card'
import Table from '../components/common/Table'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Loading from '../components/common/Loading'
import CategoryForm from '../components/categories/CategoryForm'
import DeleteConfirmModal from '../components/common/DeleteConfirmModal'
import { HiFolder, HiPlus, HiPencil, HiTrash } from 'react-icons/hi'
import './Categories.css'

export default function Categories() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories')
      return response.data.data || []
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/categories/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categories'])
      setShowDelete(false)
      setSelectedCategory(null)
    }
  })

  const handleCreate = () => {
    setSelectedCategory(null)
    setShowForm(true)
  }

  const handleEdit = (category) => {
    setSelectedCategory(category)
    setShowForm(true)
  }

  const handleDelete = (category) => {
    setSelectedCategory(category)
    setShowDelete(true)
  }

  const confirmDelete = () => {
    if (selectedCategory) {
      deleteMutation.mutate(selectedCategory.id)
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
    <div className="categories-page">
      <div className="page-header">
        <div>
          <h1>Gestión de Categorías</h1>
          <p className="page-subtitle">Administrar categorías de medicamentos e insumos</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <HiPlus />
          Nueva Categoría
        </Button>
      </div>

      <Card shadow="md" className="categories-table-card">
        {isLoading ? (
          <Loading text="Cargando categorías..." />
        ) : (
          <Table
            columns={columns}
            data={categories || []}
            emptyMessage="No hay categorías. Crea una nueva categoría para comenzar."
          />
        )}
      </Card>

      {showForm && (
        <CategoryForm
          category={selectedCategory}
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedCategory(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['categories'])
          }}
        />
      )}

      {showDelete && selectedCategory && (
        <DeleteConfirmModal
          isOpen={showDelete}
          onClose={() => {
            setShowDelete(false)
            setSelectedCategory(null)
          }}
          onConfirm={confirmDelete}
          itemName={selectedCategory.name}
          loading={deleteMutation.isPending}
          message="¿Estás seguro de que deseas eliminar esta categoría? Los medicamentos asociados no se eliminarán, pero perderán su categoría."
        />
      )}
    </div>
  )
}

