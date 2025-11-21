import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import { HiSave, HiX } from 'react-icons/hi'
import './UserForm.css'

export default function UserForm({ user, isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'farmaceutico'
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '',
        role: user.role || 'farmaceutico'
      })
    } else {
      setFormData({
        username: '',
        password: '',
        role: 'farmaceutico'
      })
    }
    setErrors({})
  }, [user])

  const createMutation = useMutation({
    mutationFn: async (newUser) => {
      const response = await api.post('/users', newUser)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al crear usuario' })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (updatedUser) => {
      const response = await api.put(`/users/${user.id}`, updatedUser)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al actualizar usuario' })
    }
  })

  const validateForm = () => {
    const newErrors = {}
    if (!formData.username.trim()) {
      newErrors.username = 'El usuario es requerido'
    }
    if (!user && !formData.password) {
      newErrors.password = 'La contraseña es requerida'
    }
    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateForm()) return

    const dataToSubmit = {
      username: formData.username.trim(),
      role: formData.role
    }

    if (formData.password) {
      dataToSubmit.password = formData.password
    }

    if (user) {
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
      title={user ? 'Editar Usuario' : 'Nuevo Usuario'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="user-form">
        {errors.api && <div className="form-error">{errors.api}</div>}

        <Input
          label="Nombre de Usuario"
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          error={errors.username}
          required
          autoFocus
        />

        <Input
          label={user ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña'}
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          error={errors.password}
          required={!user}
        />

        <div className="form-group">
          <label htmlFor="role">Rol *</label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className={`input ${errors.role ? 'input-error' : ''}`}
            required
          >
            <option value="farmaceutico">Químico Farmacéutico</option>
            <option value="admin">Administrador</option>
          </select>
          {errors.role && <span className="input-error-message">{errors.role}</span>}
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
            {user ? 'Guardar Cambios' : 'Crear Usuario'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

