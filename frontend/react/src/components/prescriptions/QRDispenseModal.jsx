import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRFID } from '../../hooks/useRFID'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import { normalizeRfidCode } from '../../utils/formatting'
import { HiWifi, HiStop, HiCheckCircle, HiExclamationCircle, HiX, HiExclamation } from 'react-icons/hi'
import './DispenseModal.css'

export default function QRDispenseModal({ prescription, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const { canViewStock } = useAuth()
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [batch, setBatch] = useState(null)
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState('') // 'not_found', 'not_in_prescription', 'already_complete', 'out_of_stock', 'insufficient'
  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  const [lastDispensedItem, setLastDispensedItem] = useState(null)

  const { lastRFID, listening, startListening, stopListening } = useRFID({
    onDetect: async (rfidUid) => {
      await handleRFIDDetected(rfidUid)
    }
  })

  const { data: fullPrescription, refetch: refetchPrescription } = useQuery({
    queryKey: ['prescription-items-qr', prescription?.id, prescription?.prescription_code],
    queryFn: async () => {
      if (!prescription) return null
      try {
        const response = await api.get(`/prescriptions/${prescription.prescription_code}`)
        if (!response.data.success) {
          throw new Error(response.data.error || 'Error al cargar la receta')
        }
        return response.data.data
      } catch (error) {
        console.error('❌ QRDispenseModal - Error al obtener receta:', error)
        return prescription
      }
    },
    enabled: isOpen && !!prescription && !!prescription.prescription_code
  })

  const getItemStatus = (item) => {
    const dispensed = item.quantity_dispensed || 0
    const required = item.quantity_required || 0
    
    if (dispensed === 0) return 'pending'
    if (dispensed >= required) return 'fulfilled'
    return 'partial'
  }

  useEffect(() => {
    const items = fullPrescription?.items || prescription?.items || []
    setPrescriptionItems(items)
    if (items.length > 0) {
      const pendingItem = items.find(
        item => {
          const status = getItemStatus(item)
          return status === 'pending' || status === 'partial'
        }
      )
      setSelectedItem(pendingItem || items[0])
    } else {
      setSelectedItem(null)
    }
  }, [isOpen, prescription, fullPrescription])

  // Limpiar estados al cerrar el modal
  const handleClose = () => {
    setError('')
    setErrorType('')
    setSuccessMessage('')
    setLastDispensedItem(null)
    setBatch(null)
    setQuantity(1)
    stopListening()
    onClose()
  }

  const handleRFIDDetected = async (rfidUid) => {
    try {
      setError('')
      setErrorType('')
      setSuccessMessage('')
      const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid.toUpperCase().trim()
      
      const response = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
      const batches = response.data.data || []
      
      if (batches.length === 0) {
        setErrorType('not_found')
        setError('MEDICAMENTO NO ENCONTRADO: No se encontró ningún lote con este código RFID en el sistema. Verifica que el tag esté registrado correctamente.')
        return
      }

      const foundBatch = batches.find(b => {
        const batchRfid = normalizeRfidCode(b.rfid_uid) || b.rfid_uid
        return batchRfid === normalizedRfid
      }) || batches[0]
      
      const productId = foundBatch.product_id
      const productName = foundBatch.product_name || 'Medicamento escaneado'

      // Buscar si el producto está en la receta
      const itemInPrescription = prescriptionItems.find(item => item.product_id === productId)
      
      if (!itemInPrescription) {
        setErrorType('not_in_prescription')
        setError(`MEDICAMENTO NO ESTÁ EN LA RECETA: El medicamento "${productName}" (ID: ${productId}) NO forma parte de esta receta. Verifica que estás escaneando el medicamento correcto.`)
        return
      }

      // Verificar si ya está completamente despachado
      const status = getItemStatus(itemInPrescription)
      if (status === 'fulfilled') {
        setErrorType('already_complete')
        setError(`MEDICAMENTO YA COMPLETADO: El medicamento "${productName}" ya fue despachado completamente (${itemInPrescription.quantity_dispensed}/${itemInPrescription.quantity_required} unidades). No se requiere más despacho.`)
        return
      }

      // Verificar si hay stock disponible
      if (foundBatch.quantity === 0) {
        setErrorType('out_of_stock')
        setError(`SIN STOCK DISPONIBLE: El medicamento "${productName}" está agotado en este lote. Stock actual: 0 unidades.`)
        return
      }

      setSelectedItem(itemInPrescription)
      setBatch(foundBatch)
      stopListening()

      const remaining = itemInPrescription.quantity_required - (itemInPrescription.quantity_dispensed || 0)
      const maxQuantity = Math.min(remaining, foundBatch.quantity)
      const currentQty = parseInt(quantity) || 1
      setQuantity(Math.min(currentQty, maxQuantity))
    } catch (err) {
      setErrorType('general')
      const errorMessage = err.response?.data?.error || err.message || 'Error al buscar el lote'
      setError(errorMessage)
    }
  }

  const fulfillMutation = useMutation({
    mutationFn: async ({ prescriptionId, itemId, batchId, qty }) => {
      const quantityValue = parseInt(qty) || 1
      if (quantityValue < 1 || isNaN(quantityValue)) {
        throw new Error('La cantidad debe ser un número mayor a 0')
      }
      
      const response = await api.put(`/prescriptions/${prescriptionId}/fulfill`, {
        prescription_item_id: parseInt(itemId),
        batch_id: parseInt(batchId),
        quantity: quantityValue
      })
      return response.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription-qr'])
      queryClient.invalidateQueries(['prescription-items-qr'])
      queryClient.invalidateQueries(['batches'])
      
      // Guardar información del item despachado
      const dispensedQty = parseInt(variables.qty) || 0
      setLastDispensedItem({
        name: selectedItem?.product_name,
        quantity: dispensedQty
      })
      
      // Mostrar mensaje de éxito
      setSuccessMessage(data?.message || `Se despacharon ${dispensedQty} unidades de "${selectedItem?.product_name}"`)
      
      // Limpiar para siguiente despacho
      setBatch(null)
      setQuantity(1)
      setError('')
      setErrorType('')
      
      // Refrescar la lista de items de la receta
      refetchPrescription()
      
      // Limpiar mensaje de éxito después de 5 segundos
      setTimeout(() => {
        setSuccessMessage('')
        setLastDispensedItem(null)
      }, 5000)
    },
    onError: (error) => {
      setErrorType('general')
      const errorMessage = error.response?.data?.error || error.message || 'Error al despachar el medicamento'
      setError(errorMessage)
    }
  })

  const handleDispense = async () => {
    if (!selectedItem || !batch) {
      setErrorType('general')
      setError('Seleccione un item y escanee el tag del medicamento')
      return
    }

    const qtyValue = parseInt(quantity) || 1
    if (qtyValue < 1 || isNaN(qtyValue)) {
      setErrorType('general')
      setError('La cantidad debe ser un número mayor a 0')
      return
    }

    const remaining = selectedItem.quantity_required - (selectedItem.quantity_dispensed || 0)
    if (qtyValue > remaining) {
      setErrorType('already_complete')
      setError(`EXCEDE LO REQUERIDO: Solo faltan ${remaining} unidades por despachar de este medicamento.`)
      return
    }

    // Verificar si el medicamento está agotado
    if (batch.quantity === 0 || selectedItem.is_out_of_stock) {
      setErrorType('out_of_stock')
      setError('SIN STOCK: Este medicamento está agotado. No se puede despachar hasta que se renueve stock.')
      return
    }

    if (qtyValue > batch.quantity) {
      setErrorType('insufficient')
      if (canViewStock()) {
        setError(`STOCK INSUFICIENTE: Solo hay ${batch.quantity} unidades disponibles en este lote. Intento de despachar: ${qtyValue} unidades.`)
      } else {
        setError('STOCK INSUFICIENTE: No hay suficiente stock disponible para despachar la cantidad solicitada.')
      }
      return
    }

    try {
      await fulfillMutation.mutateAsync({
        prescriptionId: prescription.id,
        itemId: selectedItem.id,
        batchId: batch.id,
        qty: qtyValue
      })
    } catch (err) {
      setErrorType('general')
      const errorMessage = err.response?.data?.error || err.message || 'Error al despachar el medicamento'
      setError(errorMessage)
    }
  }

  const pendingItems = prescriptionItems.filter(
    item => {
      const status = getItemStatus(item)
      return status === 'pending' || status === 'partial'
    }
  )

  const allItemsCompleted = prescriptionItems.length > 0 && pendingItems.length === 0

  const remaining = selectedItem 
    ? selectedItem.quantity_required - (selectedItem.quantity_dispensed || 0)
    : 0

  // Función para obtener el ícono y clase según tipo de error
  const getErrorDisplay = () => {
    const errorConfig = {
      'not_found': { icon: <HiExclamation />, className: 'error-not-found' },
      'not_in_prescription': { icon: <HiX />, className: 'error-not-in-prescription' },
      'already_complete': { icon: <HiCheckCircle />, className: 'error-already-complete' },
      'out_of_stock': { icon: <HiExclamationCircle />, className: 'error-out-of-stock' },
      'insufficient': { icon: <HiExclamationCircle />, className: 'error-insufficient' },
      'general': { icon: <HiExclamationCircle />, className: 'error-general' }
    }
    return errorConfig[errorType] || errorConfig['general']
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Despachar Receta - ${prescription?.prescription_code || ''}`}
      size="lg"
    >
      <div className="dispense-modal">
        {/* Mensaje de éxito prominente */}
        {successMessage && (
          <div className="dispense-success-banner">
            <HiCheckCircle className="success-icon" />
            <div className="success-content">
              <strong>¡Despacho Exitoso!</strong>
              <p>{successMessage}</p>
              <span className="success-hint">Puedes continuar despachando otros medicamentos de esta receta.</span>
            </div>
          </div>
        )}

        {/* Mensaje de error prominente */}
        {error && (
          <div className={`dispense-error-banner ${getErrorDisplay().className}`} role="alert">
            {getErrorDisplay().icon}
            <div className="error-content">
              <strong>{error.split(':')[0]}</strong>
              <p>{error.includes(':') ? error.split(':').slice(1).join(':').trim() : error}</p>
            </div>
          </div>
        )}

        {/* Aviso de receta completada */}
        {allItemsCompleted && (
          <div className="dispense-completed-banner">
            <HiCheckCircle className="completed-icon" />
            <div className="completed-content">
              <strong>¡Receta Completada!</strong>
              <p>Todos los medicamentos de esta receta han sido despachados.</p>
            </div>
          </div>
        )}

        <div className="dispense-section">
          <h4>Información de la Receta</h4>
          <div className="prescription-summary">
            <div className="info-row">
              <span className="label">Paciente:</span>
              <span className="value">{prescription?.patient_name || 'N/A'}</span>
            </div>
            <div className="info-row">
              <span className="label">Médico:</span>
              <span className="value">{prescription?.doctor_name || 'N/A'}</span>
            </div>
            <div className="info-row">
              <span className="label">Fecha:</span>
              <span className="value">
                {prescription?.prescription_date 
                  ? new Date(prescription.prescription_date).toLocaleDateString('es-ES')
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="dispense-section">
          <h4>Items de la Receta ({pendingItems.length} pendientes / {prescriptionItems.length} total)</h4>
          {prescriptionItems.length === 0 && (
            <div className="no-items-message">
              <p>No hay items en esta receta</p>
            </div>
          )}
          <div className="items-list">
            {pendingItems.length === 0 && prescriptionItems.length > 0 && (
              <p className="no-pending-items">✓ Todos los items han sido despachados</p>
            )}
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className={`item-option ${selectedItem?.id === item.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedItem(item)
                  setBatch(null)
                  setQuantity(1)
                  setError('')
                  setErrorType('')
                }}
              >
                <div>
                  <strong>{item.product_name}</strong>
                  <div className="item-quantities">
                    <span>Requerido: {item.quantity_required}</span>
                    <span>Despachado: {item.quantity_dispensed || 0}</span>
                    <span className="remaining-highlight">Faltan: {item.quantity_required - (item.quantity_dispensed || 0)}</span>
                  </div>
                </div>
                <Badge variant={getItemStatus(item) === 'partial' ? 'warning' : 'info'}>
                  {getItemStatus(item) === 'partial' ? 'Parcial' : 'Pendiente'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {selectedItem && !allItemsCompleted && (
          <>
            <div className="dispense-section">
              <h4>Escanear Tag del Medicamento</h4>
              <div className="rfid-controls">
                <Button
                  variant={listening ? 'danger' : 'primary'}
                  onClick={listening ? stopListening : startListening}
                  fullWidth
                >
                  {listening ? <HiStop /> : <HiWifi />}
                  {listening ? 'Detener Detección' : 'Activar Detección RFID'}
                </Button>
                {listening && (
                  <div className="rfid-status">
                    <span className="pulse"></span>
                    Escuchando...
                    {lastRFID && <span>Detectado: {lastRFID.uid}</span>}
                  </div>
                )}
              </div>
            </div>

            {batch && (
              <div className="dispense-section batch-section">
                <h4>Información del Lote Escaneado</h4>
                {(selectedItem?.is_out_of_stock || batch.quantity === 0) && (
                  <div className="out-of-stock-warning">
                    <HiExclamationCircle />
                    <span>Este medicamento está agotado. No se puede despachar hasta que se renueve stock.</span>
                  </div>
                )}
                <div className="batch-info">
                  <div>
                    <label>Medicamento:</label>
                    <span><strong>{selectedItem?.product_name}</strong></span>
                  </div>
                  <div>
                    <label>Código RFID:</label>
                    <span>{batch.rfid_uid}</span>
                  </div>
                  {canViewStock() && (
                    <div>
                      <label>Stock Disponible:</label>
                      <span className={batch.quantity < remaining ? 'low-stock' : ''}>{batch.quantity} unidades</span>
                    </div>
                  )}
                  <div>
                    <label>Cantidad Faltante:</label>
                    <span className="required-amount">{remaining} unidades</span>
                  </div>
                </div>

                <Input
                  label="Cantidad a Despachar"
                  type="number"
                  min="1"
                  max={selectedItem?.is_out_of_stock || batch.quantity === 0 ? 0 : Math.min(remaining, batch.quantity)}
                  value={quantity}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value === '' ? '' : (parseInt(value) || 1)
                    setQuantity(numValue)
                    setError('')
                    setErrorType('')
                  }}
                  helperText={
                    selectedItem?.is_out_of_stock || batch.quantity === 0
                      ? 'Este medicamento está agotado. No se puede despachar hasta que se renueve stock.'
                      : canViewStock() 
                        ? `Máximo: ${Math.min(remaining, batch.quantity)} unidades (Faltan ${remaining}, Stock disponible: ${batch.quantity})`
                        : `Máximo: ${Math.min(remaining, batch.quantity)} unidades (Faltan ${remaining})`
                  }
                />

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleDispense}
                  loading={fulfillMutation.isPending}
                  disabled={!quantity || parseInt(quantity) < 1 || selectedItem?.is_out_of_stock || batch.quantity === 0}
                >
                  <HiCheckCircle />
                  Despachar {parseInt(quantity) || 0} {parseInt(quantity) === 1 ? 'unidad' : 'unidades'}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Botón de cerrar siempre visible */}
        <div className="dispense-footer">
          <Button
            variant="secondary"
            onClick={handleClose}
            fullWidth
          >
            <HiX />
            {allItemsCompleted ? 'Cerrar - Receta Completada' : 'Cerrar Despacho'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
