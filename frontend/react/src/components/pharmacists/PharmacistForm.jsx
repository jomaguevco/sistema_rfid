import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import { HiSave, HiX } from 'react-icons/hi'
import './PharmacistForm.css'

export default function PharmacistForm({ pharmacist, isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    id_number: '',
    license_number: '',
    email: '',
    phone: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (pharmacist) {
      setFormData({
        name: pharmacist.name || '',
        id_number: pharmacist.id_number || '',
        license_number: pharmacist.license_number || '',
        email: pharmacist.email || '',
        phone: pharmacist.phone || ''
      })
    } else {
      setFormData({
        name: '',
        id_number: '',
        license_number: '',
        email: '',
        phone: ''
      })
    }
    setErrors({})
  }, [pharmacist, isOpen])

  const createMutation = useMutation({
    mutationFn: async (newPharmacist) => {
      const response = await api.post('/pharmacists', newPharmacist)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al crear químico farmacéutico' })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (updatedPharmacist) => {
      const response = await api.put(`/pharmacists/${pharmacist.id}`, updatedPharmacist)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al actualizar químico farmacéutico' })
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
      id_number: formData.id_number.trim() || null,
      license_number: formData.license_number.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null
    }

    if (pharmacist) {
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
      title={pharmacist ? 'Editar Químico Farmacéutico' : 'Nuevo Químico Farmacéutico'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="pharmacist-form">
        {errors.api && <div className="form-error">{errors.api}</div>}

        <Input
          label="Nombre Completo"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
          autoFocus
        />

        <div className="form-row">
          <Input
            label="DNI / Número de Identificación"
            type="text"
            value={formData.id_number}
            onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
          />
          <Input
            label="Número de Licencia / Colegiatura"
            type="text"
            value={formData.license_number}
            onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
            placeholder="Ej: CQF-001234"
          />
        </div>

        <div className="form-row">
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Teléfono"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
            {pharmacist ? 'Guardar Cambios' : 'Crear Químico'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

