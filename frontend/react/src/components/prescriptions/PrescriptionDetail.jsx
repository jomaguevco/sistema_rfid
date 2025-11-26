import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
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
    const cleaned = phone.replace(/[^0-9]/g, '')
    
    if (cleaned.startsWith('51') && (cleaned.length === 11 || cleaned.length === 12)) {
      return cleaned
    }
    
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
      return `51${cleaned}`
    }
    
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      return `51${cleaned.substring(1)}`
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('519')) {
      return cleaned
    }
    
    if (cleaned.length === 12 && cleaned.startsWith('51')) {
      return cleaned
    }
    
    if (cleaned.length <= 8) {
      return cleaned
    }
    
    if (cleaned.length > 9) {
      const last9 = cleaned.slice(-9)
      if (last9.startsWith('9')) {
        return `51${last9}`
      }
    }
    
    return cleaned
  }

  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') {
      return 'El número de teléfono es requerido'
    }
    
    const cleaned = phone.replace(/[^0-9]/g, '')
    
    if (cleaned.length < 9) {
      return 'El número debe tener al menos 9 dígitos (formato: 9XXXXXXXX)'
    }
    if (cleaned.length > 12) {
      return 'El número es demasiado largo (máximo 12 dígitos con prefijo)'
    }
    
    if (cleaned.length === 9) {
      if (!cleaned.startsWith('9')) {
        return 'El número móvil peruano debe empezar con 9 (formato: 9XXXXXXXX)'
      }
      return null
    }
    
    if (cleaned.length === 10) {
      if (!cleaned.startsWith('9')) {
        return 'El número debe empezar con 9'
      }
      return null
    }
    
    if (cleaned.length === 11) {
      if (!cleaned.startsWith('519')) {
        return 'El número con prefijo debe empezar con 519 (formato: 519XXXXXXXX)'
      }
      return null
    }
    
    if (cleaned.length === 12) {
      if (!cleaned.startsWith('51')) {
        return 'El número con prefijo debe empezar con 51'
      }
      if (cleaned[2] !== '9') {
        return 'El número móvil debe empezar con 519 después del prefijo'
      }
      return null
    }
    
    return null
  }

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (phone) => {
      const response = await api.post(`/prescriptions/${prescription.id}/send-whatsapp`, {
        phone_number: phone
      })
      return response.data
    },
    onSuccess: () => {
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
    const patientPhone = fullPrescription?.patient_phone || null
    
    if (patientPhone) {
      const normalized = normalizePhoneNumber(patientPhone)
      setPhoneNumber(normalized)
    } else {
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

    const normalizedPhone = normalizePhoneNumber(phoneNumber)
    sendWhatsAppMutation.mutate(normalizedPhone)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de Receta Médica"
      size="xl"
    >
      {isLoading ? (
        <Loading text="Cargando detalles..." />
      ) : fullPrescription ? (
        <div className="prescription-detail">
          {/* ENCABEZADO INSTITUCIONAL */}
          <div className="prescription-header">
            <div className="prescription-title">
              <h2>RECETA MÉDICA</h2>
              <span className="prescription-subtitle">Orden de Medicamentos</span>
            </div>
            <div className="prescription-meta">
              <Badge variant={getStatusVariant(fullPrescription.status)} size="lg">
                {getStatusLabel(fullPrescription.status)}
              </Badge>
            </div>
          </div>

          {/* DATOS GENERALES DEL DOCUMENTO */}
          <div className="detail-section document-info">
            <div className="info-grid info-grid-4">
              <div className="info-item">
                <label>N° Orden:</label>
                <span className="info-value highlight">{fullPrescription.receipt_number || fullPrescription.prescription_code}</span>
              </div>
              <div className="info-item">
                <label>Fecha Emisión:</label>
                <span className="info-value">{formatDate(fullPrescription.prescription_date)}</span>
              </div>
              <div className="info-item">
                <label>Especialidad:</label>
                <span className="info-value">{fullPrescription.specialty || 'General'}</span>
              </div>
              <div className="info-item">
                <label>Tipo Atención:</label>
                <span className="info-value">{fullPrescription.attention_type || 'Consulta Externa'}</span>
              </div>
            </div>
            <div className="info-grid info-grid-2">
              <div className="info-item">
                <label>Servicio:</label>
                <span className="info-value">{fullPrescription.service || 'Farmacia Consulta Externa'}</span>
              </div>
              <div className="info-item">
                <label>Código Receta:</label>
                <span className="info-value code">{fullPrescription.prescription_code}</span>
              </div>
            </div>
          </div>

          {/* DATOS DEL PACIENTE */}
          <div className="detail-section patient-section">
            <h3 className="section-title">
              <span className="section-icon">👤</span>
              Datos del Paciente
            </h3>
            <div className="info-grid info-grid-3">
              <div className="info-item">
                <label>Nombre:</label>
                <span className="info-value">{fullPrescription.patient_name || '-'}</span>
              </div>
              <div className="info-item">
                <label>DNI:</label>
                <span className="info-value">{fullPrescription.patient_dni || fullPrescription.patient_id_number || '-'}</span>
              </div>
              <div className="info-item">
                <label>Teléfono:</label>
                <span className="info-value">{fullPrescription.patient_phone || '-'}</span>
              </div>
            </div>
          </div>

          {/* DATOS DEL MÉDICO */}
          <div className="detail-section doctor-section">
            <h3 className="section-title">
              <span className="section-icon">⚕️</span>
              Médico Responsable
            </h3>
            <div className="info-grid info-grid-3">
              <div className="info-item">
                <label>Nombre:</label>
                <span className="info-value">{fullPrescription.doctor_name || '-'}</span>
              </div>
              <div className="info-item">
                <label>Colegiatura:</label>
                <span className="info-value">{fullPrescription.doctor_license || '-'}</span>
              </div>
              <div className="info-item">
                <label>Especialidad:</label>
                <span className="info-value">{fullPrescription.doctor_specialty || fullPrescription.specialty || '-'}</span>
              </div>
            </div>
          </div>

          {/* MEDICAMENTOS INDICADOS */}
          <div className="detail-section medications-section">
            <h3 className="section-title">
              <span className="section-icon">💊</span>
              Medicamentos Indicados
            </h3>
            {fullPrescription.items && fullPrescription.items.length > 0 ? (
              <div className="medications-list">
                {fullPrescription.items.map((item, index) => (
                  <div key={item.id || index} className="medication-card">
                    <div className="medication-header">
                      <span className="medication-letter">{String.fromCharCode(65 + index)})</span>
                      <span className="medication-name">
                        {item.product_name || 'Medicamento'}
                        {item.concentration && <span className="medication-concentration"> {item.concentration}</span>}
                      </span>
                      <Badge variant={getStatusVariant(getItemStatus(item))} size="sm">
                        {getStatusLabel(getItemStatus(item))}
                      </Badge>
                    </div>
                    <div className="medication-details">
                      <div className="medication-info-grid">
                        <div className="med-info-item">
                          <label>Cantidad:</label>
                          <span>{item.quantity_required || 0} unidades</span>
                        </div>
                        <div className="med-info-item">
                          <label>Despachado:</label>
                          <span>{item.quantity_dispensed || 0} unidades</span>
                        </div>
                        <div className="med-info-item">
                          <label>Vía:</label>
                          <span>{item.administration_route || 'Oral'}</span>
                        </div>
                        <div className="med-info-item">
                          <label>Dosis:</label>
                          <span>{item.dosage || item.instructions || '-'}</span>
                        </div>
                        <div className="med-info-item">
                          <label>Duración:</label>
                          <span>{item.duration || '-'}</span>
                        </div>
                        {item.item_code && (
                          <div className="med-info-item">
                            <label>Código:</label>
                            <span>{item.item_code}</span>
                          </div>
                        )}
                      </div>
                      {item.instructions && item.instructions !== item.dosage && (
                        <div className="medication-instructions">
                          <label>Indicaciones:</label>
                          <span>{item.instructions}</span>
                        </div>
                      )}
                      {item.is_out_of_stock && (
                        <div className="medication-warning">
                          <Badge variant="error" size="sm">⚠️ Producto Agotado</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-items">No hay medicamentos registrados en esta receta</p>
            )}
          </div>

          {/* NOTAS ADICIONALES */}
          {fullPrescription.notes && (
            <div className="detail-section notes-section">
              <h3 className="section-title">
                <span className="section-icon">📝</span>
                Notas Adicionales
              </h3>
              <p className="notes-content">{fullPrescription.notes}</p>
            </div>
          )}

          {/* CÓDIGO QR Y ACCIONES */}
          {fullPrescription.qr_code && (
            <div className="detail-section qr-section">
              <div className="qr-container">
                <img src={fullPrescription.qr_code} alt="QR Code" className="qr-image" />
                <div className="qr-info">
                  <p className="qr-code-text">{fullPrescription.prescription_code}</p>
                  <p className="qr-hint">Escanee para verificar autenticidad</p>
                </div>
              </div>
              <div className="prescription-actions no-print">
                <Button
                  variant="success"
                  onClick={handleOpenWhatsAppModal}
                  disabled={sendWhatsAppMutation.isLoading}
                >
                  <HiPhone style={{ marginRight: 'var(--spacing-2)' }} />
                  Enviar a WhatsApp
                </Button>
              </div>
            </div>
          )}

          {/* FIRMA DEL MÉDICO (Solo para impresión) */}
          <div className="signature-section print-only">
            <div className="signature-line"></div>
            <p className="signature-label">Firma y Sello del Médico</p>
          </div>
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
