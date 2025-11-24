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
import { HiWifi, HiStop, HiCheckCircle, HiExclamationCircle } from 'react-icons/hi'
import './DispenseModal.css'

export default function QRDispenseModal({ prescription, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const { canViewStock } = useAuth()
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [batch, setBatch] = useState(null)
  const [error, setError] = useState('')
  const [prescriptionItems, setPrescriptionItems] = useState([])

  const { lastRFID, listening, startListening, stopListening } = useRFID({
    onDetect: async (rfidUid) => {
      await handleRFIDDetected(rfidUid)
    }
  })

  const { data: fullPrescription } = useQuery({
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

  const handleRFIDDetected = async (rfidUid) => {
    try {
      setError('')
      const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid.toUpperCase().trim()
      
      const response = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
      const batches = response.data.data || []
      
      if (batches.length === 0) {
        setError('No se encontró un lote con este tag RFID. Verifica que el tag esté registrado en el sistema.')
        return
      }

      const foundBatch = batches.find(b => {
        const batchRfid = normalizeRfidCode(b.rfid_uid) || b.rfid_uid
        return batchRfid === normalizedRfid
      }) || batches[0]
      
      const productId = foundBatch.product_id

      const item = prescriptionItems.find(
        item => {
          if (item.product_id !== productId) return false
          const status = getItemStatus(item)
          return status === 'pending' || status === 'partial'
        }
      )

      if (!item) {
        setError('Este medicamento no está en la receta o ya está completado')
        return
      }

      setSelectedItem(item)
      setBatch(foundBatch)
      stopListening()

      const remaining = item.quantity_required - (item.quantity_dispensed || 0)
      const maxQuantity = Math.min(remaining, foundBatch.quantity)
      const currentQty = parseInt(quantity) || 1
      setQuantity(Math.min(currentQty, maxQuantity))
    } catch (err) {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription-qr'])
      queryClient.invalidateQueries(['prescription-items-qr'])
      if (data?.message) {
        console.log('✅', data.message)
      }
      onSuccess?.()
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.error || error.message || 'Error al despachar el medicamento'
      setError(errorMessage)
    }
  })

  const handleDispense = async () => {
    if (!selectedItem || !batch) {
      setError('Seleccione un item y escanee el tag del medicamento')
      return
    }

    const qtyValue = parseInt(quantity) || 1
    if (qtyValue < 1 || isNaN(qtyValue)) {
      setError('La cantidad debe ser un número mayor a 0')
      return
    }

    const remaining = selectedItem.quantity_required - (selectedItem.quantity_dispensed || 0)
    if (qtyValue > remaining) {
      setError(`La cantidad no puede exceder ${remaining} unidades requeridas`)
      return
    }

    // Verificar si el medicamento está agotado
    if (batch.quantity === 0 || selectedItem.is_out_of_stock) {
      setError('Este medicamento está agotado. No se puede despachar hasta que se renueve stock.')
      return
    }

    if (qtyValue > batch.quantity) {
      if (canViewStock()) {
        setError(`Stock insuficiente. Disponible: ${batch.quantity} unidades, Intento de despachar: ${qtyValue}`)
      } else {
        setError('Stock insuficiente. No se puede despachar la cantidad solicitada.')
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

  const remaining = selectedItem 
    ? selectedItem.quantity_required - (selectedItem.quantity_dispensed || 0)
    : 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Despachar Receta - ${prescription?.prescription_code || ''}`}
      size="lg"
    >
      <div className="dispense-modal">
        {error && (
          <div className="error-message" role="alert">
            {error}
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
          <h4>Items Pendientes</h4>
          {prescriptionItems.length === 0 && (
            <div className="no-items-message">
              <p>No hay items en esta receta</p>
            </div>
          )}
          <div className="items-list">
            {pendingItems.length === 0 && prescriptionItems.length > 0 && (
              <p className="no-pending-items">Todos los items han sido despachados</p>
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
                }}
              >
                <div>
                  <strong>{item.product_name}</strong>
                  <div className="item-quantities">
                    <span>Requerido: {item.quantity_required}</span>
                    <span>Despachado: {item.quantity_dispensed || 0}</span>
                    <span>Faltan: {item.quantity_required - (item.quantity_dispensed || 0)}</span>
                  </div>
                </div>
                <Badge variant={getItemStatus(item) === 'partial' ? 'partial' : 'pending'}>
                  {getItemStatus(item) === 'partial' ? 'Parcial' : 'Pendiente'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {selectedItem && (
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
                  {listening ? 'Detener Detección' : 'Activar Detección'}
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
              <div className="dispense-section">
                <h4>Información del Lote</h4>
                {(selectedItem?.is_out_of_stock || batch.quantity === 0) && (
                  <div className="out-of-stock-warning" style={{ 
                    padding: '12px', 
                    marginBottom: '16px', 
                    backgroundColor: '#fee', 
                    border: '1px solid #fcc',
                    borderRadius: '4px',
                    color: '#c33',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <HiExclamationCircle />
                    <span>Este medicamento está agotado. No se puede despachar hasta que se renueve stock.</span>
                  </div>
                )}
                <div className="batch-info">
                  <div>
                    <label>Código de Identificación:</label>
                    <span>{batch.rfid_uid}</span>
                  </div>
                  {canViewStock() && (
                    <div>
                      <label>Stock Disponible:</label>
                      <span>{batch.quantity}</span>
                    </div>
                  )}
                  <div>
                    <label>Cantidad Faltante:</label>
                    <span>{remaining}</span>
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

        {fulfillMutation.isSuccess && (
          <div className="success-message">
            <HiCheckCircle />
            <div>
              <strong>Item despachado correctamente</strong>
              <p>Se despacharon {parseInt(quantity) || 0} unidades del medicamento {selectedItem?.product_name}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}


