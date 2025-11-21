import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import { HiSave, HiX } from 'react-icons/hi'
import './PatientForm.css'

export default function PatientForm({ patient, isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    id_number: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        id_number: patient.id_number || '',
        date_of_birth: patient.date_of_birth || '',
        gender: patient.gender || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || ''
      })
    } else {
      setFormData({
        name: '',
        id_number: '',
        date_of_birth: '',
        gender: '',
        phone: '',
        email: '',
        address: ''
      })
    }
    setErrors({})
  }, [patient, isOpen])

  const createMutation = useMutation({
    mutationFn: async (newPatient) => {
      const response = await api.post('/patients', newPatient)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al crear paciente' })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (updatedPatient) => {
      const response = await api.put(`/patients/${patient.id}`, updatedPatient)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al actualizar paciente' })
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
      date_of_birth: formData.date_of_birth || null,
      gender: formData.gender || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null
    }

    if (patient) {
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
      title={patient ? 'Editar Paciente' : 'Nuevo Paciente'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="patient-form">
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
            label="DNI/ID"
            type="text"
            value={formData.id_number}
            onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
          />
          <Input
            label="Fecha de Nacimiento"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="gender">Género</label>
          <select
            id="gender"
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className="input"
          >
            <option value="">Seleccionar...</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="O">Otro</option>
          </select>
        </div>

        <div className="form-row">
          <Input
            label="Teléfono"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="address">Dirección</label>
          <textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
            {patient ? 'Guardar Cambios' : 'Crear Paciente'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

