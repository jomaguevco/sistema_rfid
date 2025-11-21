import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRFID } from '../../hooks/useRFID'
import api from '../../services/api'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import { HiWifi, HiStop, HiCheckCircle } from 'react-icons/hi'
import './DispenseModal.css'

export default function DispenseModal({ prescription, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
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
    queryKey: ['prescription-items', prescription?.id, prescription?.prescription_code],
    queryFn: async () => {
      if (!prescription) return null
      try {
        console.log('🔍 DispenseModal - Obteniendo receta:', prescription.prescription_code)
        const response = await api.get(`/prescriptions/${prescription.prescription_code}`)
        console.log('✅ DispenseModal - Respuesta recibida:', {
          success: response.data.success,
          itemsCount: response.data.data?.items?.length || 0,
          items: response.data.data?.items
        })
        if (!response.data.success) {
          throw new Error(response.data.error || 'Error al cargar la receta')
        }
        return response.data.data
      } catch (error) {
        console.error('❌ DispenseModal - Error al obtener receta:', error)
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
    console.log('📦 DispenseModal - Items recibidos:', items.length, items)
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
      const response = await api.get(`/batches?rfid_uid=${rfidUid}`)
      const batches = response.data.data || []
      
      if (batches.length === 0) {
        setError('No se encontró un lote con este tag')
        return
      }

      const foundBatch = batches[0]
      const productId = foundBatch.product_id

      // Verificar que el medicamento esté en la receta
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

      // Calcular cantidad máxima
      const remaining = item.quantity_required - (item.quantity_dispensed || 0)
      const maxQuantity = Math.min(remaining, foundBatch.quantity)
      setQuantity(Math.min(quantity, maxQuantity))
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar el lote')
    }
  }

  const fulfillMutation = useMutation({
    mutationFn: async ({ prescriptionId, itemId, batchId, qty }) => {
      const response = await api.put(`/prescriptions/${prescriptionId}/fulfill`, {
        prescription_item_id: itemId,
        batch_id: batchId,
        quantity: qty
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription', prescription.id])
      onSuccess?.()
    }
  })

  const handleDispense = async () => {
    if (!selectedItem || !batch) {
      setError('Seleccione un item y escanee el tag del medicamento')
      return
    }

    const remaining = selectedItem.quantity_required - (selectedItem.quantity_dispensed || 0)
    if (quantity > remaining) {
      setError(`La cantidad no puede exceder ${remaining} unidades`)
      return
    }

    if (quantity > batch.quantity) {
      setError(`Stock insuficiente. Disponible: ${batch.quantity}`)
      return
    }

    try {
      await fulfillMutation.mutateAsync({
        prescriptionId: prescription.id,
        itemId: selectedItem.id,
        batchId: batch.id,
        qty: quantity
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Error al despachar')
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
      title="Despachar Receta"
      size="lg"
    >
      <div className="dispense-modal">
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <div className="dispense-section">
          <h4>Items Pendientes</h4>
          {prescriptionItems.length === 0 && (
            <div className="no-items-message">
              <p>No hay items en esta receta</p>
              {fullPrescription && (
                <p className="debug-info">Debug: Receta ID {fullPrescription.id}, Items: {fullPrescription.items?.length || 0}</p>
              )}
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
                    <span>Faltan: {remaining}</span>
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
                <div className="batch-info">
                  <div>
                    <label>Código de Identificación:</label>
                    <span>{batch.rfid_uid}</span>
                  </div>
                  <div>
                    <label>Stock Disponible:</label>
                    <span>{batch.quantity}</span>
                  </div>
                  <div>
                    <label>Cantidad Faltante:</label>
                    <span>{remaining}</span>
                  </div>
                </div>

                <Input
                  label="Cantidad a Despachar"
                  type="number"
                  min="1"
                  max={Math.min(remaining, batch.quantity)}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  helperText={`Máximo: ${Math.min(remaining, batch.quantity)} unidades`}
                />

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleDispense}
                  loading={fulfillMutation.isPending}
                >
                  <HiCheckCircle />
                  Despachar {quantity} {quantity === 1 ? 'unidad' : 'unidades'}
                </Button>
              </div>
            )}
          </>
        )}

        {fulfillMutation.isSuccess && (
          <div className="success-message">
            Item despachado correctamente
          </div>
        )}
      </div>
    </Modal>
  )
}

