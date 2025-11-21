import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import Table from '../common/Table'
import './PrescriptionDetail.css'

export default function PrescriptionDetail({ prescription, isOpen, onClose }) {
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
    </Modal>
  )
}

