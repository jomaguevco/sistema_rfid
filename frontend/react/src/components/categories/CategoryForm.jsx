import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import { HiSave, HiX } from 'react-icons/hi'
import './CategoryForm.css'

export default function CategoryForm({ category, isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || '',
        description: category.description || ''
      })
    } else {
      setFormData({
        name: '',
        description: ''
      })
    }
    setErrors({})
  }, [category])

  const createMutation = useMutation({
    mutationFn: async (newCategory) => {
      const response = await api.post('/categories', newCategory)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al crear categoría' })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (updatedCategory) => {
      const response = await api.put(`/categories/${category.id}`, updatedCategory)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al actualizar categoría' })
    }
  })

  const validateForm = () => {
    const newErrors = {}
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateForm()) return

    const dataToSubmit = {
      name: formData.name.trim(),
      description: formData.description.trim() || null
    }

    if (category) {
      updateMutation.mutate(dataToSubmit)
    } else {
      createMutation.mutate(dataToSubmit)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? 'Editar Categoría' : 'Nueva Categoría'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="category-form">
        {errors.api && <div className="form-error">{errors.api}</div>}

        <Input
          label="Nombre de la Categoría"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
          autoFocus
        />

        <div className="form-group">
          <label htmlFor="description">Descripción</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="input"
          />
        </div>

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <HiX />
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
          >
            <HiSave />
            {category ? 'Guardar Cambios' : 'Crear Categoría'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

