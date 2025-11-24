import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import Table from '../common/Table'
import Button from '../common/Button'
import Input from '../common/Input'
import { HiCheckCircle, HiXCircle, HiPhone } from 'react-icons/hi'
import './PrescriptionDetail.css'

export default function PrescriptionDetail({ prescription, isOpen, onClose }) {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const { data: fullPrescription, isLoading, error } = useQuery({
    queryKey: ['prescription', prescription?.id, prescription?.prescription_code],
    queryFn: async () => {
      if (!prescription?.prescription_code) {
        throw new Error('Código de receta no disponible')
      }
      const response = await api.get(`/prescriptions/${prescription.prescription_code}`)
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al cargar la receta')
      }
      console.log('📋 PrescriptionDetail - Datos recibidos:', {
        id: response.data.data?.id,
        code: response.data.data?.prescription_code,
        itemsCount: response.data.data?.items?.length || 0,
        items: response.data.data?.items
      })
      return response.data.data
    },
    enabled: isOpen && !!prescription && !!prescription.prescription_code,
    retry: 1
  })

  const getItemStatus = (item) => {
    const dispensed = item.quantity_dispensed || 0
    const required = item.quantity_required || 0
    
    if (dispensed === 0) return 'pending'
    if (dispensed >= required) return 'fulfilled'
    return 'partial'
  }

  const getStatusVariant = (status) => {
    const variants = {
      pending: 'pending',
      partial: 'partial',
      fulfilled: 'completed',
      cancelled: 'error'
    }
    return variants[status] || 'default'
  }

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pendiente',
      partial: 'Parcial',
      fulfilled: 'Completo',
      cancelled: 'Cancelado'
    }
    return labels[status] || status
  }

  // Normalizar número de teléfono con prefijo de Perú (51)
  const normalizePhoneNumber = (phone) => {
    if (!phone) return ''
    // Eliminar espacios, guiones, paréntesis, etc.
    const cleaned = phone.replace(/[^0-9]/g, '')
    
    // Si ya tiene prefijo 51 y tiene 11 o 12 dígitos, mantenerlo
    if (cleaned.startsWith('51') && (cleaned.length === 11 || cleaned.length === 12)) {
      return cleaned
    }
    
    // Si tiene 9 dígitos y empieza con 9 (número móvil peruano), agregar prefijo 51
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
      return `51${cleaned}`
    }
    
    // Si tiene 10 dígitos y empieza con 9, tomar los últimos 9 y agregar prefijo
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      return `51${cleaned.substring(1)}`
    }
    
    // Si tiene 11 dígitos y empieza con 519, ya está bien formateado
    if (cleaned.length === 11 && cleaned.startsWith('519')) {
      return cleaned
    }
    
    // Si tiene 12 dígitos y empieza con 51, ya está bien formateado
    if (cleaned.length === 12 && cleaned.startsWith('51')) {
      return cleaned
    }
    
    // Si tiene 8 dígitos o menos, no es válido (retornar tal cual para que la validación lo detecte)
    if (cleaned.length <= 8) {
      return cleaned
    }
    
    // Para otros casos, intentar extraer los últimos 9 dígitos si empiezan con 9
    if (cleaned.length > 9) {
      const last9 = cleaned.slice(-9)
      if (last9.startsWith('9')) {
        return `51${last9}`
      }
    }
    
    // Retornar tal cual si no cumple ningún formato conocido
    return cleaned
  }

  // Validar número de teléfono peruano
  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') {
      return 'El número de teléfono es requerido'
    }
    
    const cleaned = phone.replace(/[^0-9]/g, '')
    
    // Debe tener entre 9 y 12 dígitos
    if (cleaned.length < 9) {
      return 'El número debe tener al menos 9 dígitos (formato: 9XXXXXXXX)'
    }
    if (cleaned.length > 12) {
      return 'El número es demasiado largo (máximo 12 dígitos con prefijo)'
    }
    
    // Si tiene 9 dígitos, debe empezar con 9 (número móvil peruano)
    if (cleaned.length === 9) {
      if (!cleaned.startsWith('9')) {
        return 'El número móvil peruano debe empezar con 9 (formato: 9XXXXXXXX)'
      }
      return null // Válido
    }
    
    // Si tiene 10 dígitos, debe empezar con 9
    if (cleaned.length === 10) {
      if (!cleaned.startsWith('9')) {
        return 'El número debe empezar con 9'
      }
      return null // Válido (se normalizará)
    }
    
    // Si tiene 11 dígitos, debe empezar con 519 (51 + 9XXXXXXXX)
    if (cleaned.length === 11) {
      if (!cleaned.startsWith('519')) {
        return 'El número con prefijo debe empezar con 519 (formato: 519XXXXXXXX)'
      }
      return null // Válido
    }
    
    // Si tiene 12 dígitos, debe empezar con 51
    if (cleaned.length === 12) {
      if (!cleaned.startsWith('51')) {
        return 'El número con prefijo debe empezar con 51'
      }
      // Verificar que después del 51 tenga un 9
      if (cleaned[2] !== '9') {
        return 'El número móvil debe empezar con 519 después del prefijo'
      }
      return null // Válido
    }
    
    return null
  }

  // Mutación para enviar a WhatsApp
  const sendWhatsAppMutation = useMutation({
    mutationFn: async (phone) => {
      const response = await api.post(`/prescriptions/${prescription.id}/send-whatsapp`, {
        phone_number: phone
      })
      return response.data
    },
    onSuccess: () => {
      // Cerrar modal después de 2 segundos para que el usuario vea el mensaje de éxito
      setTimeout(() => {
        setShowWhatsAppModal(false)
        setPhoneNumber('')
        setPhoneError('')
        sendWhatsAppMutation.reset()
      }, 2000)
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.error || error.message || 'Error al enviar a WhatsApp'
      setPhoneError(errorMessage)
    }
  })

  const handleOpenWhatsAppModal = () => {
    // Obtener teléfono del paciente desde los datos de la receta
    const patientPhone = fullPrescription?.patient_phone || null
    
    if (patientPhone) {
      // Si hay teléfono del paciente, normalizarlo y prellenarlo
      const normalized = normalizePhoneNumber(patientPhone)
      setPhoneNumber(normalized)
    } else {
      // Si no hay teléfono, dejar vacío para que el usuario lo ingrese
      setPhoneNumber('')
    }
    
    setShowWhatsAppModal(true)
    setPhoneError('')
  }

  const handleSendWhatsApp = () => {
    const validationError = validatePhoneNumber(phoneNumber)
    if (validationError) {
      setPhoneError(validationError)
      return
    }

    // Normalizar el número antes de enviar
    const normalizedPhone = normalizePhoneNumber(phoneNumber)
    sendWhatsAppMutation.mutate(normalizedPhone)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de Receta"
      size="xl"
    >
      {isLoading ? (
        <Loading text="Cargando detalles..." />
      ) : fullPrescription ? (
        <div className="prescription-detail">
          <div className="detail-section prescription-code-section">
            <div className="prescription-code-display">
              <label>Código de Receta:</label>
              <Badge variant="info" size="lg" className="prescription-code-badge">
                {fullPrescription.prescription_code}
              </Badge>
            </div>
            {fullPrescription.status && (
              <div className="prescription-status-display">
                <label>Estado:</label>
                <Badge variant={getStatusVariant(fullPrescription.status)} size="md">
                  {getStatusLabel(fullPrescription.status)}
                </Badge>
              </div>
            )}
            {fullPrescription.prescription_date && (
              <div className="prescription-date-display">
                <label>Fecha de Emisión:</label>
                <span>{new Date(fullPrescription.prescription_date).toLocaleDateString('es-ES')}</span>
              </div>
            )}
          </div>

          <div className="detail-section">
            <h3>Información del Paciente</h3>
            <div className="detail-grid">
              <div>
                <label>Nombre:</label>
                <span>{fullPrescription.patient_name}</span>
              </div>
              {(fullPrescription.patient_id_number || fullPrescription.patient_id) && (
                <div>
                  <label>DNI/ID:</label>
                  <span>{fullPrescription.patient_id_number || fullPrescription.patient_id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>Información del Médico</h3>
            <div className="detail-grid">
              <div>
                <label>Nombre:</label>
                <span>{fullPrescription.doctor_name}</span>
              </div>
              {fullPrescription.doctor_license && (
                <div>
                  <label>Colegiatura:</label>
                  <span>{fullPrescription.doctor_license}</span>
                </div>
              )}
            </div>
          </div>

          <div className="detail-section">
            <h3>Medicamentos</h3>
            {fullPrescription.items && fullPrescription.items.length > 0 ? (
              <Table
                columns={[
                  {
                    key: 'product_name',
                    field: 'product_name',
                    header: 'Nombre',
                    className: 'col-name'
                  },
                  {
                    key: 'active_ingredient',
                    field: 'active_ingredient',
                    header: 'Principio Activo',
                    render: (value) => value || '-'
                  },
                  {
                    key: 'concentration',
                    field: 'concentration',
                    header: 'Concentración',
                    render: (value) => value || '-'
                  },
                  {
                    key: 'quantity_required',
                    field: 'quantity_required',
                    header: 'Cantidad Requerida',
                    render: (value) => value || 0
                  },
                  {
                    key: 'quantity_dispensed',
                    field: 'quantity_dispensed',
                    header: 'Despachado',
                    render: (value) => value || 0
                  },
                  {
                    key: 'status',
                    header: 'Estado',
                    render: (_, row) => {
                      const itemStatus = getItemStatus(row)
                      return (
                        <Badge variant={getStatusVariant(itemStatus)}>
                          {getStatusLabel(itemStatus)}
                        </Badge>
                      )
                    }
                  },
                  {
                    key: 'instructions',
                    field: 'instructions',
                    header: 'Instrucciones',
                    render: (value) => value || '-'
                  }
                ]}
                data={fullPrescription.items}
                emptyMessage="No hay medicamentos registrados en esta receta"
              />
            ) : (
              <p className="no-items">No hay medicamentos registrados en esta receta</p>
            )}
          </div>

          {fullPrescription.qr_code && (
            <div className="detail-section">
              <h3>Código QR</h3>
              <div className="qr-display">
                <img src={fullPrescription.qr_code} alt="QR Code" />
                <p className="qr-code">{fullPrescription.prescription_code}</p>
              </div>
              <div style={{ marginTop: 'var(--spacing-4)', display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="success"
                  onClick={handleOpenWhatsAppModal}
                  disabled={sendWhatsAppMutation.isLoading}
                >
                  <HiPhone style={{ marginRight: 'var(--spacing-2)' }} />
                  {fullPrescription?.patient_phone ? 'Enviar a WhatsApp' : 'Enviar a WhatsApp'}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="error-message">
          <p>❌ Error al cargar los detalles de la receta</p>
          <p className="error-detail">{error.message || 'Error desconocido'}</p>
        </div>
      ) : (
        <p>No se pudieron cargar los detalles de la receta</p>
      )}

      {/* Modal para enviar a WhatsApp */}
      <Modal
        isOpen={showWhatsAppModal}
        onClose={() => {
          setShowWhatsAppModal(false)
          setPhoneNumber('')
          setPhoneError('')
        }}
        title="Enviar Receta a WhatsApp"
        size="md"
      >
        <div style={{ padding: 'var(--spacing-4)' }}>
          {fullPrescription?.patient_phone ? (
            <div style={{
              marginBottom: 'var(--spacing-4)',
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-info-light)',
              borderRadius: 'var(--border-radius-md)',
              color: 'var(--color-info)',
              fontSize: 'var(--font-size-sm)'
            }}>
              📱 <strong>Teléfono del paciente encontrado:</strong> {fullPrescription.patient_phone}
              <br />
              <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>
                Puedes usar este número o ingresar otro diferente.
              </span>
            </div>
          ) : (
            <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-gray-600)' }}>
              Ingresa el número de teléfono para enviar la receta y su código QR por WhatsApp.
            </p>
          )}
          
          <Input
            label="Número de Teléfono"
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value)
              setPhoneError('')
            }}
            placeholder="Ej: 987654321 o 51987654321"
            error={phoneError}
            disabled={sendWhatsAppMutation.isLoading}
            helperText="Formato: 9XXXXXXXX (9 dígitos) o 519XXXXXXXX (con prefijo de Perú)"
          />

          {sendWhatsAppMutation.isSuccess && (
            <div style={{
              marginTop: 'var(--spacing-4)',
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-success-light)',
              borderRadius: 'var(--border-radius-md)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)'
            }}>
              <HiCheckCircle />
              <span>Receta enviada correctamente a WhatsApp</span>
            </div>
          )}

          {sendWhatsAppMutation.isError && (
            <div style={{
              marginTop: 'var(--spacing-4)',
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-error-light)',
              borderRadius: 'var(--border-radius-md)',
              color: 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)'
            }}>
              <HiXCircle />
              <span>{sendWhatsAppMutation.error?.response?.data?.error || sendWhatsAppMutation.error?.message || 'Error al enviar'}</span>
            </div>
          )}

          <div style={{
            marginTop: 'var(--spacing-6)',
            display: 'flex',
            gap: 'var(--spacing-3)',
            justifyContent: 'flex-end'
          }}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowWhatsAppModal(false)
                setPhoneNumber('')
                setPhoneError('')
              }}
              disabled={sendWhatsAppMutation.isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleSendWhatsApp}
              loading={sendWhatsAppMutation.isLoading}
              disabled={!phoneNumber || sendWhatsAppMutation.isLoading}
            >
              <HiPhone style={{ marginRight: 'var(--spacing-2)' }} />
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}

