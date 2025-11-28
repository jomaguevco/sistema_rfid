import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import { HiSave, HiX } from 'react-icons/hi'
import './DoctorForm.css'

export default function DoctorForm({ doctor, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    license_number: '',
    specialty: '',
    area_id: '',
    email: '',
    phone: '',
    username: ''
  })
  const [errors, setErrors] = useState({})

  const { data: areas } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      try {
        const response = await api.get('/areas?all=true')
        return response.data.data || []
      } catch {
        return []
      }
    },
    enabled: isOpen
  })

  useEffect(() => {
    if (doctor) {
      setFormData({
        name: doctor.name || '',
        license_number: doctor.license_number || '',
        specialty: doctor.specialty || '',
        area_id: doctor.area_id || '',
        email: doctor.email || '',
        phone: doctor.phone || '',
        username: doctor.username || ''
      })
    } else {
      setFormData({
        name: '',
        license_number: '',
        specialty: '',
        area_id: '',
        email: '',
        phone: '',
        username: ''
      })
    }
    setErrors({})
  }, [doctor, isOpen])

  const createMutation = useMutation({
    mutationFn: async (newDoctor) => {
      const response = await api.post('/doctors', newDoctor)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al crear doctor' })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (updatedDoctor) => {
      const response = await api.put(`/doctors/${doctor.id}`, updatedDoctor)
      return response.data
    },
    onSuccess: (data) => {
      // Invalidar todas las queries de doctors para refrescar la lista
      queryClient.invalidateQueries({ queryKey: ['doctors'] })
      // También refetch inmediatamente para asegurar que los datos estén actualizados
      queryClient.refetchQueries({ queryKey: ['doctors'] })
      onSuccess()
      onClose()
    },
    onError: (error) => {
      setErrors({ api: error.response?.data?.error || 'Error al actualizar doctor' })
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
      license_number: formData.license_number.trim() || null,
      specialty: formData.specialty.trim() || null,
      area_id: formData.area_id ? parseInt(formData.area_id) : null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      username: formData.username.trim() || null
    }

    if (doctor) {
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
      title={doctor ? 'Editar Doctor' : 'Nuevo Doctor'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="doctor-form">
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
            label="Número de Colegiatura"
            type="text"
            value={formData.license_number}
            onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
          />
          <Input
            label="Especialidad"
            type="text"
            value={formData.specialty}
            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            placeholder="Ej: Cardiología, Pediatría"
          />
        </div>

        <div className="form-group">
          <label htmlFor="area_id">Área (Opcional)</label>
          <select
            id="area_id"
            value={formData.area_id}
            onChange={(e) => setFormData({ ...formData, area_id: e.target.value })}
            className="input"
          >
            <option value="">Medicina General (Sin área específica)</option>
            {areas?.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
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

        <Input
          label="Nombre de Usuario"
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          placeholder="Ej: dr_guevara, medico_cotrina"
          helperText="Opcional: Nombre de usuario único para el médico"
        />

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
            {doctor ? 'Guardar Cambios' : 'Crear Doctor'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

