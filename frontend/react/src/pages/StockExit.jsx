import { useState, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useRFID } from '../hooks/useRFID'
import api from '../services/api'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Modal from '../components/common/Modal'
import Input from '../components/common/Input'
import Loading from '../components/common/Loading'
import Badge from '../components/common/Badge'
import { normalizeRfidCode } from '../utils/formatting'
import { HiArrowUp, HiWifi, HiStop, HiCheckCircle, HiExclamation } from 'react-icons/hi'
import './StockExit.css'

export default function StockExit() {
  const queryClient = useQueryClient()
  const [processing, setProcessing] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [currentBatch, setCurrentBatch] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [area_id, setArea_id] = useState(null) // Estandarizado: usar area_id (snake_case) y null en lugar de string vacío
  const [lastProcessed, setLastProcessed] = useState(null)
  const [error, setError] = useState('')

  // Cargar áreas al montar el componente
  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: async () => {
      try {
        const response = await api.get('/areas')
        return response.data.data || []
      } catch {
        return []
      }
    }
  })

  const handleRFIDExit = async (rfidUid) => {
    if (processing) return

    try {
      setProcessing(true)
      setError('')
      
      // Normalizar RFID antes de buscar (estandarizado)
      const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid.toUpperCase().trim()
      
      const batchResponse = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
      const batches = batchResponse.data.data || []
      // Buscar batch usando rfid_uid normalizado
      const batch = batches.find(b => {
        const batchRfid = normalizeRfidCode(b.rfid_uid) || b.rfid_uid
        return batchRfid === normalizedRfid
      })

      if (!batch) {
        setError('Lote no encontrado para este tag RFID')
        return
      }

      if (batch.quantity <= 0) {
        setError(`Stock insuficiente en este lote. Stock disponible: ${batch.quantity} unidades`)
        return
      }

      // Obtener información del producto
      const productResponse = await api.get(`/products/${batch.product_id}`)
      const product = productResponse.data.data || {
        id: batch.product_id,
        name: batch.product_name || 'Medicamento',
        units_per_package: 1
      }

      setCurrentProduct(product)
      setCurrentBatch(batch)
      // Inicializar cantidad en 1 (siempre unidades individuales)
      setQuantity(1)
      setArea_id(null) // Resetear a null (estandarizado)
      
      // Mostrar modal de confirmación
      setShowConfirmModal(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar medicamento. Verifica que el tag RFID esté registrado en el sistema.')
    } finally {
      setProcessing(false)
    }
  }

  const processExit = async () => {
    if (!currentBatch || !currentProduct) return

    try {
      setProcessing(true)
      setError('')
      
      const qty = parseInt(quantity) || 1 // Asegurar que sea number
      // Convertir area_id: string vacío o null a null, string numérico a number
      let areaIdValue = null
      if (area_id) {
        if (typeof area_id === 'string' && area_id.trim() !== '') {
          areaIdValue = parseInt(area_id) || null
        } else if (typeof area_id === 'number') {
          areaIdValue = area_id
        }
      }
      const area = areaIdValue
      
      // Validar cantidad
      if (qty <= 0) {
        setError('La cantidad debe ser mayor a 0')
        return
      }
      
      if (qty > currentBatch.quantity) {
        setError(`Cantidad excede el stock disponible (${currentBatch.quantity} unidades disponibles)`)
        return
      }
      
      const response = await api.post('/stock/exit', {
        rfid_uid: currentBatch.rfid_uid,
        quantity: qty,
        area_id: area
      })

        const areaName = areas.find(a => a.id === area)?.name || 'No especificada'

      setLastProcessed({
        product: currentProduct.name,
        quantity: qty,
        area: areaName,
        message: response.data?.data?.message || response.data?.message || 'Salida registrada correctamente',
        remaining_stock: response.data?.data?.batch?.quantity || response.data?.data?.remaining_stock || (currentBatch.quantity - qty)
      })

      setShowConfirmModal(false)
      setCurrentProduct(null)
      setCurrentBatch(null)
      setQuantity(1)
      setArea_id(null) // Resetear a null (estandarizado)
      
      // Invalidar queries para actualizar datos
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['batches'])
      queryClient.invalidateQueries(['stock'])
      
      // Limpiar mensaje de éxito después de 5 segundos
      setTimeout(() => {
        setLastProcessed(null)
      }, 5000)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar salida')
    } finally {
      setProcessing(false)
    }
  }

  // Calcular días hasta vencimiento
  const getDaysToExpiry = (expiryDate) => {
    if (!expiryDate) return null
    const expiry = new Date(expiryDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = expiry - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysToExpiry = currentBatch ? getDaysToExpiry(currentBatch.expiry_date) : null
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0
  const isExpired = daysToExpiry !== null && daysToExpiry < 0

  const { listening, startListening, stopListening, lastRFID } = useRFID({
    onDetect: (rfidUid, data) => {
      if (data?.action === 'remove' || !data?.action) {
        handleRFIDExit(rfidUid)
      }
    }
  })

  return (
    <div className="stock-exit-page">
      <div className="page-header">
        <div>
          <h1>Salida de Stock</h1>
          <p className="page-subtitle">Registrar retiro de medicamentos mediante identificación por proximidad</p>
        </div>
      </div>

      <Card shadow="md" className="exit-card">
        <div className="exit-content">
          <div className="exit-instructions">
            <h3>Instrucciones</h3>
            <ul>
              <li>Activa el modo de detección por proximidad</li>
              <li>Acerca el tag del medicamento al lector</li>
              <li>Revisa la información del producto detectado</li>
              <li>Especifica la cantidad a retirar si es necesario</li>
              <li>Selecciona el área de destino (opcional)</li>
              <li>Confirma la salida de stock</li>
            </ul>
          </div>

          {/* Selector de área siempre visible */}
          {areas.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Área de Destino (Opcional)
              </label>
              <select
                value={area_id || ''}
                onChange={(e) => {
                  const value = e.target.value
                  // Convertir string vacío a null, string numérico a number
                  setArea_id(value === '' ? null : (parseInt(value) || null))
                }}
                className="input"
                style={{ width: '100%', padding: '0.75rem' }}
                disabled={processing}
              >
                <option value="">Seleccionar área...</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="exit-controls">
            <Button
              variant={listening ? 'danger' : 'primary'}
              size="lg"
              onClick={listening ? stopListening : startListening}
              disabled={processing}
              fullWidth
            >
              {listening ? <HiStop /> : <HiWifi />}
              {listening ? 'Detener Detección' : 'Activar Detección por Proximidad'}
            </Button>

            {listening && (
              <div className="rfid-status">
                <span className="rfid-indicator pulse"></span>
                <span>Detección por proximidad activa - Acerca el tag RFID</span>
                {lastRFID && (
                  <span className="last-rfid">Último detectado: {lastRFID.uid}</span>
                )}
              </div>
            )}

            {processing && (
              <div className="processing-status">
                <Loading size="sm" text="Procesando salida..." />
              </div>
            )}

            {error && (
              <div className="error-message" role="alert" style={{ marginTop: '1rem' }}>
                {error}
              </div>
            )}

            {lastProcessed && (
              <div className="success-message" style={{ marginTop: '1rem' }}>
                <HiCheckCircle />
                <div>
                  <strong>Salida registrada correctamente</strong>
                  <p>Medicamento: {lastProcessed.product}</p>
                  <p>Cantidad retirada: {lastProcessed.quantity} unidades</p>
                  <p>Área: {lastProcessed.area}</p>
                  {lastProcessed.remaining_stock !== undefined && (
                    <p>Stock restante: {lastProcessed.remaining_stock} unidades</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false)
          setCurrentProduct(null)
          setCurrentBatch(null)
          setQuantity(1)
          setError('')
        }}
        title="Confirmar Retiro de Stock"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowConfirmModal(false)
                setCurrentProduct(null)
                setCurrentBatch(null)
                setQuantity(1)
                setError('')
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={processExit}
              loading={processing}
              disabled={processing || !currentBatch || quantity <= 0}
            >
              Confirmar Retiro
            </Button>
          </>
        }
      >
        {currentProduct && currentBatch && (
          <div className="quantity-modal-content">
            <div className="product-info" style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>{currentProduct.name}</h4>
              {currentProduct.active_ingredient && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                  {currentProduct.active_ingredient}
                </p>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Badge variant="info" size="sm">
                  Stock disponible: {currentBatch.quantity} unidades
                </Badge>
                {currentBatch.lot_number && (
                  <Badge variant="secondary" size="sm">
                    Lote: {currentBatch.lot_number}
                  </Badge>
                )}
                {isExpired && (
                  <Badge variant="danger" size="sm">
                    <HiExclamation /> Vencido
                  </Badge>
                )}
                {isExpiringSoon && !isExpired && (
                  <Badge variant="warning" size="sm">
                    <HiExclamation /> Vence en {daysToExpiry} días
                  </Badge>
                )}
              </div>
              {currentBatch.expiry_date && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                  Fecha de vencimiento: {new Date(currentBatch.expiry_date).toLocaleDateString('es-ES')}
                </p>
              )}
            </div>

            {isExpired && (
              <div className="error-message" style={{ marginBottom: '1rem', backgroundColor: '#fee', padding: '0.75rem', borderRadius: '4px' }}>
                <HiExclamation /> <strong>Advertencia:</strong> Este producto está vencido. No se recomienda su uso.
              </div>
            )}

            {isExpiringSoon && !isExpired && (
              <div style={{ marginBottom: '1rem', backgroundColor: '#fff3cd', padding: '0.75rem', borderRadius: '4px', color: '#856404' }}>
                <HiExclamation /> <strong>Advertencia:</strong> Este producto vence pronto (en {daysToExpiry} días).
              </div>
            )}

            <Input
              label={`Cantidad a Retirar${currentProduct.units_per_package > 1 ? ` (máximo ${currentBatch.quantity} unidades)` : ''}`}
              type="number"
              min="1"
              max={currentBatch.quantity}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1
                if (val > currentBatch.quantity) {
                  setError(`La cantidad no puede exceder el stock disponible (${currentBatch.quantity} unidades)`)
                } else {
                  setError('')
                }
                setQuantity(val)
              }}
              error={error && error.includes('Cantidad') ? error : ''}
              helperText={`Máximo: ${currentBatch.quantity} unidades disponibles`}
            />

            {error && !error.includes('Cantidad') && (
              <div className="error-message" style={{ marginTop: '0.5rem' }}>
                {error}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
