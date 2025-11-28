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
import { 
  HiWifi, 
  HiStop, 
  HiCheckCircle, 
  HiExclamationCircle, 
  HiX, 
  HiCube,
  HiClipboardList,
  HiShoppingCart
} from 'react-icons/hi'
import './DispenseModal.css'

export default function DispenseModal({ prescription, isOpen, onClose, onSuccess }) {
  const queryClient = useQueryClient()
  const { canViewStock } = useAuth()
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [batch, setBatch] = useState(null)
  const [error, setError] = useState('')
  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [dispenseQueue, setDispenseQueue] = useState([])
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

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

  // Limpiar cola cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setDispenseQueue([])
      setError('')
      setSuccessMessage('')
      setIsProcessingBatch(false)
    }
  }, [isOpen])

  // Funciones auxiliares para la cola de despacho
  const addToDispenseQueue = (item, batch) => {
    const remaining = item.quantity_required - (item.quantity_dispensed || 0)
    const maxQuantity = Math.min(remaining, batch.quantity)
    const initialQuantity = Math.min(1, maxQuantity)
    
    const queueItem = {
      id: `${batch.rfid_uid}-${Date.now()}`,
      prescriptionItemId: item.id,
      productId: item.product_id,
      productName: item.product_name,
      batchId: batch.id,
      batchRfid: batch.rfid_uid,
      quantity: initialQuantity,
      maxQuantity: maxQuantity,
      remaining: remaining,
      stockAvailable: batch.quantity
    }
    
    setDispenseQueue(prev => [...prev, queueItem])
    setSuccessMessage(`✅ ${item.product_name} agregado a la cola de despacho`)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const removeFromDispenseQueue = (queueId) => {
    setDispenseQueue(prev => prev.filter(item => item.id !== queueId))
  }

  const updateDispenseQueueQuantity = (queueId, newQuantity) => {
    setDispenseQueue(prev => prev.map(item => {
      if (item.id === queueId) {
        const qty = parseInt(newQuantity) || 1
        const clampedQty = Math.max(1, Math.min(qty, item.maxQuantity))
        return { ...item, quantity: clampedQty }
      }
      return item
    }))
  }

  const clearDispenseQueue = () => {
    setDispenseQueue([])
  }

  const handleRFIDDetected = async (rfidUid) => {
    try {
      setError('')
      const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid.toUpperCase().trim()
      
      const alreadyInQueue = dispenseQueue.some(q => {
        const queueRfid = normalizeRfidCode(q.batchRfid) || q.batchRfid
        return queueRfid === normalizedRfid
      })
      
      if (alreadyInQueue) {
        setError('Este medicamento ya fue escaneado. Está en la lista de despacho.')
        setTimeout(() => setError(''), 3000)
        return
      }
      
      const response = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
      const batches = response.data.data || []
      
      if (batches.length === 0) {
        setError('No se encontró un lote con este tag RFID. Verifica que el tag esté registrado en el sistema.')
        setTimeout(() => setError(''), 3000)
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
        setTimeout(() => setError(''), 3000)
        return
      }

      addToDispenseQueue(item, foundBatch)
    } catch (err) {
      let errorMessage = err.response?.data?.error || err.message || 'Error al buscar el lote'
      
      if (err.isNetworkError || err.userMessage) {
        errorMessage = err.userMessage || 'Error de conexión con el servidor. Verifica que el backend esté corriendo y que hayas aceptado el certificado HTTPS.'
      }
      
      setError(errorMessage)
      setTimeout(() => setError(''), 5000)
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
      // Invalidar queries con exact: false para capturar todas las variantes
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription', prescription.id])
      queryClient.invalidateQueries(['prescription-items'])
      queryClient.invalidateQueries({ queryKey: ['stock'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['batches'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false })
      queryClient.invalidateQueries(['stock-overview-stats'])
      queryClient.invalidateQueries(['stock-low-critical'])
      queryClient.invalidateQueries(['stock-expiring'])
      
      // ═══════════════════════════════════════════════════════════════════════════
      // REFETCH INMEDIATO de queries específicas
      // ═══════════════════════════════════════════════════════════════════════════
      if (data?.batch) {
        const productId = data.batch.product_id
        const batchRfid = data.batch.rfid_uid
        queryClient.refetchQueries(['batches', 'product', productId]).catch(console.error)
        queryClient.refetchQueries(['batches', 'rfid', batchRfid]).catch(console.error)
        queryClient.refetchQueries(['products', productId]).catch(console.error)
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // REFETCH CON DELAY de queries generales
      // ═══════════════════════════════════════════════════════════════════════════
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['stock'], exact: false }).catch(console.error)
        queryClient.refetchQueries({ queryKey: ['batches'], exact: false }).catch(console.error)
        queryClient.refetchQueries({ queryKey: ['products'], exact: false }).catch(console.error)
        queryClient.refetchQueries(['stock-overview-stats']).catch(console.error)
        queryClient.refetchQueries(['stock-low-critical']).catch(console.error)
        queryClient.refetchQueries(['stock-expiring']).catch(console.error)
      }, 300)
      
      if (data?.message) {
        console.log('✅', data.message)
      }
      onSuccess?.()
    },
    onError: (error) => {
      let errorMessage = error.response?.data?.error || error.message || 'Error al despachar el medicamento'
      
      if (error.isNetworkError || error.userMessage) {
        errorMessage = error.userMessage || 'Error de conexión con el servidor. Verifica que el backend esté corriendo y que hayas aceptado el certificado HTTPS.'
      }
      
      setError(errorMessage)
    }
  })

  const validateDispenseQueue = () => {
    if (dispenseQueue.length === 0) {
      return { valid: false, error: 'No hay medicamentos en la cola de despacho' }
    }

    for (const queueItem of dispenseQueue) {
      if (queueItem.quantity <= 0) {
        return { valid: false, error: `${queueItem.productName}: La cantidad debe ser mayor a 0` }
      }

      if (queueItem.quantity > queueItem.maxQuantity) {
        return { 
          valid: false, 
          error: `${queueItem.productName}: La cantidad (${queueItem.quantity}) excede el máximo permitido (${queueItem.maxQuantity})` 
        }
      }

      if (queueItem.remaining <= 0) {
        return { valid: false, error: `${queueItem.productName}: Este medicamento ya está completado` }
      }

      if (queueItem.stockAvailable <= 0) {
        return { valid: false, error: `${queueItem.productName}: Stock insuficiente` }
      }
    }

    return { valid: true }
  }

  const batchFulfillMutation = useMutation({
    mutationFn: async (queueItems) => {
      const results = []
      const errors = []

      for (const queueItem of queueItems) {
        try {
          // Agregar timeout específico para cada petición (20 segundos)
          const response = await api.put(`/prescriptions/${prescription.id}/fulfill`, {
            prescription_item_id: queueItem.prescriptionItemId,
            batch_id: queueItem.batchId,
            quantity: queueItem.quantity
          }, {
            timeout: 20000 // 20 segundos por item
          })
          results.push({
            success: true,
            item: queueItem,
            data: response.data
          })
        } catch (error) {
          // Mejorar el manejo de errores de timeout
          let errorMessage = error.response?.data?.error || error.message
          
          if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
            errorMessage = 'Timeout: La petición tardó demasiado tiempo'
          } else if (error.isNetworkError || error.userMessage) {
            errorMessage = error.userMessage || 'Error de conexión con el servidor'
          }
          
          errors.push({
            success: false,
            item: queueItem,
            error: errorMessage
          })
          
          // Continuar con el siguiente item aunque este haya fallado
          console.error(`❌ Error al despachar ${queueItem.productName}:`, errorMessage)
        }
      }

      return { results, errors }
    },
    onSuccess: (data) => {
      // Invalidar queries con exact: false para capturar todas las variantes
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription', prescription.id])
      queryClient.invalidateQueries(['prescription-items'])
      queryClient.invalidateQueries({ queryKey: ['stock'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['batches'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false })
      queryClient.invalidateQueries(['stock-overview-stats'])
      queryClient.invalidateQueries(['stock-low-critical'])
      queryClient.invalidateQueries(['stock-expiring'])
      
      // Invalidar queries específicas por producto y RFID
      data.results.forEach(result => {
        const productId = result.item.productId
        const batchRfid = result.item.batchRfid
        queryClient.invalidateQueries(['batches', 'product', productId])
        queryClient.invalidateQueries(['batches', 'rfid', batchRfid])
        queryClient.invalidateQueries(['products', productId])
      })
      
      // Obtener todos los productIds únicos de los items despachados
      const productIds = [...new Set(data.results.map(r => r.item.productId).filter(Boolean))]
      console.log(`🔄 [DispenseModal] Items despachados: ${data.results.length}, Product IDs: ${productIds.join(', ')}`)
      
      // ═══════════════════════════════════════════════════════════════════════════
      // REFETCH CON DELAY - Esperar 500ms para asegurar que el backend haya commiteado
      // ═══════════════════════════════════════════════════════════════════════════
      setTimeout(() => {
        console.log('🔄 [DispenseModal] Refetch con delay (500ms) iniciado...')
        
        // Refetch de queries generales
        Promise.all([
          queryClient.refetchQueries({ queryKey: ['stock'], exact: false }),
          queryClient.refetchQueries({ queryKey: ['batches'], exact: false }),
          queryClient.refetchQueries({ queryKey: ['products'], exact: false }),
          queryClient.refetchQueries(['stock-overview-stats']),
          queryClient.refetchQueries(['stock-low-critical']),
          queryClient.refetchQueries(['stock-expiring'])
        ]).then(() => {
          console.log('✅ [DispenseModal] Refetch de queries generales completado')
        }).catch(console.error)
        
        // Refetch de queries específicas por producto
        productIds.forEach(productId => {
          queryClient.refetchQueries(['batches', 'product', productId]).catch(console.error)
          queryClient.refetchQueries(['products', productId]).catch(console.error)
        })
        
        // Refetch de queries específicas por RFID
        data.results.forEach(result => {
          const batchRfid = result.item.batchRfid
          if (batchRfid) {
            queryClient.refetchQueries(['batches', 'rfid', batchRfid]).catch(console.error)
          }
        })
      }, 500)
      
      // ═══════════════════════════════════════════════════════════════════════════
      // REFETCH ADICIONAL - Después de 1 segundo para asegurar actualización completa
      // ═══════════════════════════════════════════════════════════════════════════
      setTimeout(() => {
        console.log('🔄 [DispenseModal] Refetch adicional (1s) para asegurar actualización...')
        queryClient.refetchQueries({ queryKey: ['stock'], exact: false }).catch(console.error)
        queryClient.refetchQueries({ queryKey: ['products'], exact: false }).catch(console.error)
        
        // Refetch adicional de productos específicos
        productIds.forEach(productId => {
          queryClient.refetchQueries(['products', productId]).catch(console.error)
        })
      }, 1000)
      
      const successCount = data.results.length
      const errorCount = data.errors.length
      
      if (errorCount === 0) {
        // Construir mensaje detallado con información de batches usados
        const batchInfo = data.results
          .filter(r => r.data?.batch_used)
          .map(r => {
            const batch = r.data.batch_used
            return `${r.item.productName} (RFID: ${batch.rfid_uid}, Lote: ${batch.lot_number}, Stock restante: ${batch.quantity_after})`
          })
          .join('; ')
        
        const successMsg = batchInfo 
          ? `✅ Se despacharon correctamente ${successCount} medicamento(s). ${batchInfo}`
          : `✅ Se despacharon correctamente ${successCount} medicamento(s)`
        
        setSuccessMessage(successMsg)
        clearDispenseQueue()
        onSuccess?.()
      } else {
        const errorMessages = data.errors.map(e => `${e.item.productName}: ${e.error}`).join('; ')
        setError(`Se despacharon ${successCount} medicamento(s), pero ${errorCount} fallaron: ${errorMessages}`)
        const successfulIds = data.results.map(r => r.item.id)
        setDispenseQueue(prev => prev.filter(item => !successfulIds.includes(item.id)))
      }
      
      setIsProcessingBatch(false)
    },
    onError: (error) => {
      setIsProcessingBatch(false)
      let errorMessage = error.response?.data?.error || error.message || 'Error al despachar los medicamentos'
      
      if (error.isNetworkError || error.userMessage) {
        errorMessage = error.userMessage || 'Error de conexión con el servidor. Verifica que el backend esté corriendo y que hayas aceptado el certificado HTTPS.'
      }
      
      setError(errorMessage)
    }
  })

  const handleBatchDispense = async () => {
    const validation = validateDispenseQueue()
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setIsProcessingBatch(true)
    setError('')
    setSuccessMessage('')

    try {
      await batchFulfillMutation.mutateAsync(dispenseQueue)
    } catch (err) {
      console.error('Error en despacho masivo:', err)
    }
  }

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
      let errorMessage = err.response?.data?.error || err.message || 'Error al despachar el medicamento'
      
      if (err.isNetworkError || err.userMessage) {
        errorMessage = err.userMessage || 'Error de conexión con el servidor. Verifica que el backend esté corriendo y que hayas aceptado el certificado HTTPS.'
      }
      
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

  const totalUnits = dispenseQueue.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Despachar Receta"
      size="xl"
    >
      <div className="dispense-modal-v2">
        {/* Alertas */}
        {error && (
          <div className="alert alert-error">
            <HiExclamationCircle />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <HiCheckCircle />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Grid principal */}
        <div className="dispense-grid">
          {/* Columna izquierda: Items pendientes */}
          <div className="dispense-column">
            <div className="section-header">
              <HiClipboardList />
              <h3>Medicamentos Pendientes</h3>
              <Badge variant="info" size="sm">{pendingItems.length}</Badge>
            </div>

            {prescriptionItems.length === 0 ? (
              <div className="empty-state">
                <p>No hay items en esta receta</p>
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="empty-state success">
                <HiCheckCircle />
                <p>Todos los items han sido despachados</p>
              </div>
            ) : (
              <div className="items-grid">
                {pendingItems.map((item) => {
                  const itemRemaining = item.quantity_required - (item.quantity_dispensed || 0)
                  const status = getItemStatus(item)
                  return (
                    <div
                      key={item.id}
                      className={`item-card ${selectedItem?.id === item.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedItem(item)
                        setBatch(null)
                        setQuantity(1)
                        setError('')
                      }}
                    >
                      <div className="item-card-header">
                        <h4>{item.product_name}</h4>
                        <Badge variant={status === 'partial' ? 'warning' : 'info'}>
                          {status === 'partial' ? 'Parcial' : 'Pendiente'}
                        </Badge>
                      </div>
                      <div className="item-card-stats">
                        <div className="stat">
                          <span className="stat-label">Requerido</span>
                          <span className="stat-value">{item.quantity_required}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Despachado</span>
                          <span className="stat-value">{item.quantity_dispensed || 0}</span>
                        </div>
                        <div className="stat highlight">
                          <span className="stat-label">Faltan</span>
                          <span className="stat-value">{itemRemaining}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Columna derecha: Escaneo y cola */}
          <div className="dispense-column">
            {/* Sección de escaneo RFID */}
            {pendingItems.length > 0 && (
              <div className="scan-section">
                <div className="section-header">
                  <HiWifi />
                  <h3>Escanear Medicamentos</h3>
                </div>
                <div className="scan-controls">
                  <Button
                    variant={listening ? 'danger' : 'primary'}
                    size="lg"
                    onClick={listening ? stopListening : startListening}
                    fullWidth
                    disabled={isProcessingBatch}
                    className="scan-button"
                  >
                    {listening ? (
                      <>
                        <HiStop />
                        <span>Detener Escaneo</span>
                      </>
                    ) : (
                      <>
                        <HiWifi />
                        <span>Iniciar Escaneo RFID</span>
                      </>
                    )}
                  </Button>
                  {listening && (
                    <div className="scan-status">
                      <div className="pulse-indicator"></div>
                      <span>Escuchando...</span>
                      {lastRFID && (
                        <span className="detected-rfid">Detectado: {lastRFID.uid}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cola de despacho */}
            {dispenseQueue.length > 0 && (
              <div className="queue-section">
                <div className="section-header">
                  <HiShoppingCart />
                  <h3>Cola de Despacho</h3>
                  <Badge variant="primary" size="sm">{dispenseQueue.length}</Badge>
                </div>

                <div className="queue-list">
                  {dispenseQueue.map((queueItem) => (
                    <div key={queueItem.id} className="queue-card">
                      <div className="queue-card-main">
                        <div className="queue-card-info">
                          <h4>{queueItem.productName}</h4>
                          <div className="queue-card-meta">
                            <Badge variant="secondary" size="sm">
                              <HiCube /> {queueItem.batchRfid}
                            </Badge>
                            {canViewStock() && (
                              <span className="meta-item">
                                Stock: <strong>{queueItem.stockAvailable}</strong>
                              </span>
                            )}
                            <span className="meta-item warning">
                              Faltan: <strong>{queueItem.remaining}</strong>
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeFromDispenseQueue(queueItem.id)}
                          disabled={isProcessingBatch}
                          className="remove-button"
                        >
                          <HiX />
                        </Button>
                      </div>
                      <div className="queue-card-quantity">
                        <label>Cantidad a despachar</label>
                        <div className="quantity-controls">
                          <Input
                            type="number"
                            min="1"
                            max={queueItem.maxQuantity}
                            value={queueItem.quantity}
                            onChange={(e) => {
                              const value = e.target.value
                              const numValue = value === '' ? 1 : (parseInt(value) || 1)
                              updateDispenseQueueQuantity(queueItem.id, numValue)
                            }}
                            disabled={isProcessingBatch}
                            className="quantity-input"
                          />
                          <span className="quantity-max">máx {queueItem.maxQuantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="queue-summary-card">
                  <div className="summary-row">
                    <span>Medicamentos</span>
                    <strong>{dispenseQueue.length}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Unidades totales</span>
                    <strong>{totalUnits}</strong>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleBatchDispense}
                  loading={isProcessingBatch}
                  disabled={isProcessingBatch || dispenseQueue.length === 0}
                  className="dispatch-button"
                >
                  <HiCheckCircle />
                  <span>Despachar Todo ({dispenseQueue.length} medicamento{dispenseQueue.length !== 1 ? 's' : ''})</span>
                </Button>
              </div>
            )}

            {/* Sección de despacho individual (legacy) */}
            {selectedItem && batch && dispenseQueue.length === 0 && (
              <div className="single-dispense-section">
                <div className="section-header">
                  <HiCube />
                  <h3>Información del Lote</h3>
                </div>
                {(selectedItem?.is_out_of_stock || batch.quantity === 0) && (
                  <div className="alert alert-warning">
                    <HiExclamationCircle />
                    <span>Este medicamento está agotado. No se puede despachar hasta que se renueve stock.</span>
                  </div>
                )}
                <div className="batch-info-grid">
                  <div className="info-item">
                    <label>RFID</label>
                    <Badge variant="secondary">{batch.rfid_uid}</Badge>
                  </div>
                  {canViewStock() && (
                    <div className="info-item">
                      <label>Stock Disponible</label>
                      <Badge variant="success">{batch.quantity}</Badge>
                    </div>
                  )}
                  <div className="info-item">
                    <label>Cantidad Faltante</label>
                    <Badge variant="warning">{remaining}</Badge>
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
                      ? 'Este medicamento está agotado.'
                      : canViewStock() 
                        ? `Máximo: ${Math.min(remaining, batch.quantity)} unidades`
                        : `Máximo: ${Math.min(remaining, batch.quantity)} unidades`
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
          </div>
        </div>

        {fulfillMutation.isSuccess && !isProcessingBatch && (
          <div className="alert alert-success">
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
