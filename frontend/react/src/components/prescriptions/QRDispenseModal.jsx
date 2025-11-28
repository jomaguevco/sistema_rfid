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

export default function QRDispenseModal({ prescription, isOpen, onClose, onSuccess }) {
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
    const initialQuantity = maxQuantity
    
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
      setSuccessMessage('')
      const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid.toUpperCase().trim()
      
      // Verificar si el RFID ya está en la cola
      const alreadyInQueue = dispenseQueue.find(item => {
        const itemRfid = normalizeRfidCode(item.batchRfid) || item.batchRfid
        return itemRfid === normalizedRfid
      })
      
      if (alreadyInQueue) {
        setError('Este medicamento ya fue escaneado y está en la cola de despacho')
        setTimeout(() => setError(''), 3000)
        return
      }
      
      const response = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
      const batches = response.data.data || []
      
      if (batches.length === 0) {
        setError('MEDICAMENTO NO ENCONTRADO: No se encontró ningún lote con este código RFID en el sistema.')
        setTimeout(() => setError(''), 5000)
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
      queryClient.invalidateQueries(['prescription-qr'])
      queryClient.invalidateQueries(['prescription-items-qr'])
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
      console.log('🔄 [QRDispenseModal] Iniciando invalidación y refetch después del despacho...')
      console.log(`   Items despachados: ${data.results.length}`)
      
      // Obtener todos los productIds únicos de los items despachados
      const productIds = [...new Set(data.results.map(r => r.item.productId).filter(Boolean))]
      console.log(`   Product IDs a refrescar: ${productIds.join(', ')}`)
      
      // ═══════════════════════════════════════════════════════════════════════════
      // INVALIDAR QUERIES - Usar exact: false para capturar todas las variantes
      // ═══════════════════════════════════════════════════════════════════════════
      queryClient.invalidateQueries(['prescriptions'])
      queryClient.invalidateQueries(['prescription-qr'])
      queryClient.invalidateQueries(['prescription-items-qr'])
      queryClient.invalidateQueries({ queryKey: ['stock'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['batches'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['products'], exact: false })
      queryClient.invalidateQueries(['stock-overview-stats'])
      queryClient.invalidateQueries(['stock-low-critical'])
      queryClient.invalidateQueries(['stock-expiring'])
      
      // Invalidar queries específicas por producto
      productIds.forEach(productId => {
        queryClient.invalidateQueries(['batches', 'product', productId])
        queryClient.invalidateQueries(['products', productId])
      })
      
      // Invalidar queries específicas por RFID
      data.results.forEach(result => {
        const batchRfid = result.item.batchRfid
        if (batchRfid) {
          queryClient.invalidateQueries(['batches', 'rfid', batchRfid])
        }
      })
      
      // ═══════════════════════════════════════════════════════════════════════════
      // REFETCH CON DELAY - Esperar 500ms para asegurar que el backend haya commiteado
      // ═══════════════════════════════════════════════════════════════════════════
      setTimeout(() => {
        console.log('🔄 [QRDispenseModal] Refetch con delay (500ms) iniciado...')
        
        // Refetch de queries generales
        Promise.all([
          queryClient.refetchQueries({ queryKey: ['stock'], exact: false }),
          queryClient.refetchQueries({ queryKey: ['batches'], exact: false }),
          queryClient.refetchQueries({ queryKey: ['products'], exact: false }),
          queryClient.refetchQueries(['stock-overview-stats']),
          queryClient.refetchQueries(['stock-low-critical']),
          queryClient.refetchQueries(['stock-expiring'])
        ]).then(() => {
          console.log('✅ [QRDispenseModal] Refetch de queries generales completado')
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
        console.log('🔄 [QRDispenseModal] Refetch adicional (1s) para asegurar actualización...')
        queryClient.refetchQueries({ queryKey: ['stock'], exact: false }).catch(console.error)
        queryClient.refetchQueries({ queryKey: ['products'], exact: false }).catch(console.error)
        
        // Refetch adicional de productos específicos
        productIds.forEach(productId => {
          queryClient.refetchQueries(['products', productId]).catch(console.error)
        })
      }, 1000)
      
      const successCount = data.results.length
      const errorCount = data.errors.length
      
      // ═══════════════════════════════════════════════════════════════════════════
      // FORZAR REFETCH AGRESIVO DE TODAS LAS QUERIES DE STOCK
      // ═══════════════════════════════════════════════════════════════════════════
      console.log('🔄 Forzando refetch agresivo de todas las queries de stock...')
      
      // Invalidar y refetch todas las queries relacionadas con stock
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['products'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['batches'], exact: false })
      ]).then(() => {
        console.log('✅ Invalidación completada, iniciando refetch...')
        // Refetch todas las queries de stock
        return Promise.all([
          queryClient.refetchQueries({ queryKey: ['stock'], exact: false }),
          queryClient.refetchQueries({ queryKey: ['products'], exact: false }),
          queryClient.refetchQueries({ queryKey: ['batches'], exact: false })
        ])
      }).then(() => {
        console.log('✅ Refetch agresivo completado')
      }).catch(err => {
        console.error('❌ Error en refetch agresivo:', err)
      })
      
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
        refetchPrescription()
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
      setError(`Solo faltan ${remaining} unidades por despachar de este medicamento.`)
      return
    }

    if (qtyValue > batch.quantity) {
      setError(`Stock insuficiente. Solo hay ${batch.quantity} unidades disponibles.`)
      return
    }

    try {
      await fulfillMutation.mutateAsync({
        prescriptionId: prescription.id,
        itemId: selectedItem.id,
        batchId: batch.id,
        qty: qtyValue
      })
      refetchPrescription()
    } catch (err) {
      console.error('Error al despachar:', err)
    }
  }

  const pendingItems = prescriptionItems.filter(
    item => {
      const status = getItemStatus(item)
      return status === 'pending' || status === 'partial'
    }
  )

  const allItemsCompleted = prescriptionItems.length > 0 && pendingItems.length === 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setDispenseQueue([])
        setError('')
        setSuccessMessage('')
        setIsProcessingBatch(false)
        stopListening()
        onClose()
      }}
      title={`Despachar Receta - ${prescription?.prescription_code || ''}`}
      size="lg"
      className="qr-dispense-modal-wide"
    >
      <div className="dispense-modal-v2">
        {/* Alertas */}
        {error && (
          <div className="alert alert-error">
            <HiExclamationCircle />
            <div>
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <HiCheckCircle />
            <div>
              <strong>Éxito</strong>
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        {allItemsCompleted && (
          <div className="alert alert-success">
            <HiCheckCircle />
            <div>
              <strong>Receta Completada</strong>
              <p>Todos los medicamentos de esta receta han sido despachados.</p>
            </div>
          </div>
        )}

        <div className="dispense-grid">
          {/* Columna Izquierda: Items Pendientes */}
          <div className="dispense-column">
            <div className="section-header">
              <HiClipboardList />
              <h3>Items Pendientes ({pendingItems.length})</h3>
            </div>

            {pendingItems.length === 0 ? (
              <div className="empty-state success">
                <HiCheckCircle />
                <p>Todos los items han sido despachados</p>
              </div>
            ) : (
              <div className="items-grid">
                {pendingItems.map((item) => {
                  const status = getItemStatus(item)
                  const remaining = item.quantity_required - (item.quantity_dispensed || 0)
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
                          <span className="stat-value">{remaining}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Columna Derecha: Escaneo y Cola de Despacho */}
          <div className="dispense-column">
            {/* Sección de Escaneo */}
            {pendingItems.length > 0 && (
              <div className="scan-section">
                <div className="section-header">
                  <HiWifi />
                  <h3>Escanear Tag del Medicamento</h3>
                </div>
                <div className="scan-controls">
                  <Button
                    variant={listening ? 'danger' : 'primary'}
                    onClick={listening ? stopListening : startListening}
                    className="scan-button"
                    disabled={isProcessingBatch}
                    fullWidth
                  >
                    {listening ? <><HiStop /> Detener Detección</> : <><HiWifi /> Activar Detección</>}
                  </Button>
                  {listening && (
                    <div className="scan-status">
                      <span className="pulse-indicator"></span>
                      <span>Escuchando RFID...</span>
                      {lastRFID && <span className="detected-rfid">Detectado: {lastRFID.uid}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sección de Cola de Despacho */}
            {dispenseQueue.length > 0 && (
              <div className="queue-section">
                <div className="section-header">
                  <HiShoppingCart />
                  <h3>Detalle de Despacho ({dispenseQueue.length})</h3>
                </div>

                <div className="queue-list">
                  {dispenseQueue.map((queueItem) => (
                    <div key={queueItem.id} className="queue-card">
                      <div className="queue-card-main">
                        <div className="queue-card-info">
                          <h4>{queueItem.productName}</h4>
                          <div className="queue-card-meta">
                            <span className="meta-item">
                              <strong>RFID:</strong> {queueItem.batchRfid}
                            </span>
                            <span className="meta-item">
                              <strong>Stock:</strong> {queueItem.stockAvailable}
                            </span>
                            <span className="meta-item">
                              <strong>Faltan:</strong> {queueItem.remaining}
                            </span>
                            {queueItem.quantity > queueItem.maxQuantity && (
                              <span className="meta-item warning">
                                <strong>⚠ Excede máximo</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeFromDispenseQueue(queueItem.id)}
                          className="remove-button"
                        >
                          <HiX />
                        </Button>
                      </div>
                      <div className="queue-card-quantity">
                        <label>Cantidad a Despachar</label>
                        <div className="quantity-controls">
                          <Input
                            type="number"
                            min="1"
                            max={queueItem.maxQuantity}
                            value={queueItem.quantity}
                            onChange={(e) => updateDispenseQueueQuantity(queueItem.id, e.target.value)}
                            className="quantity-input"
                          />
                          <span className="quantity-max">Máx: {queueItem.maxQuantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="queue-summary-card">
                  <div className="summary-row">
                    <span>Total de Medicamentos:</span>
                    <strong>{dispenseQueue.length}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Total de Unidades:</span>
                    <strong>{dispenseQueue.reduce((sum, item) => sum + item.quantity, 0)}</strong>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleBatchDispense}
                  loading={isProcessingBatch}
                  disabled={dispenseQueue.length === 0 || isProcessingBatch}
                  className="dispatch-button"
                  fullWidth
                >
                  <HiCheckCircle />
                  Despachar Todo
                </Button>
              </div>
            )}

            {/* Sección de Despacho Individual (solo si no hay cola) */}
            {selectedItem && batch && dispenseQueue.length === 0 && (
              <div className="single-dispense-section">
                <div className="section-header">
                  <HiCube />
                  <h3>Información del Lote</h3>
                </div>
                <div className="batch-info-grid">
                  <div className="info-item">
                    <label>Medicamento</label>
                    <span><strong>{selectedItem.product_name}</strong></span>
                  </div>
                  <div className="info-item">
                    <label>RFID</label>
                    <span>{batch.rfid_uid}</span>
                  </div>
                  {canViewStock() && (
                    <div className="info-item">
                      <label>Stock Disponible</label>
                      <span>{batch.quantity} unidades</span>
                    </div>
                  )}
                  <div className="info-item">
                    <label>Faltan</label>
                    <span>{selectedItem.quantity_required - (selectedItem.quantity_dispensed || 0)} unidades</span>
                  </div>
                </div>
                <Input
                  label="Cantidad a Despachar"
                  type="number"
                  min="1"
                  max={Math.min(selectedItem.quantity_required - (selectedItem.quantity_dispensed || 0), batch.quantity)}
                  value={quantity}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value === '' ? '' : (parseInt(value) || 1)
                    setQuantity(numValue)
                    setError('')
                  }}
                />
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleDispense}
                  loading={fulfillMutation.isPending}
                  disabled={!quantity || parseInt(quantity) < 1}
                  fullWidth
                >
                  <HiCheckCircle />
                  Despachar {parseInt(quantity) || 0} {parseInt(quantity) === 1 ? 'unidad' : 'unidades'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
