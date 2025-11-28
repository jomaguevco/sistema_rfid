import { useState } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useRFID } from '../hooks/useRFID'
import api from '../services/api'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import Loading from '../components/common/Loading'
import Badge from '../components/common/Badge'
import { normalizeRfidCode, formatRfidCode } from '../utils/formatting'
import { HiArrowUp, HiWifi, HiStop, HiCheckCircle, HiExclamation, HiX } from 'react-icons/hi'
import './StockExit.css'

export default function StockExit() {
  const queryClient = useQueryClient()
  const [processing, setProcessing] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [currentBatch, setCurrentBatch] = useState(null)
  const [scannedRfid, setScannedRfid] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [area_id, setArea_id] = useState(null)
  const [lastProcessed, setLastProcessed] = useState(null)
  const [error, setError] = useState('')
  const [listening, setListening] = useState(false)

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

  // Constantes de validación
  const VALIDATION_RULES = {
    MIN_QUANTITY: 1,
    MAX_QUANTITY_PER_OPERATION: 10000,
    ALLOW_EXPIRED_BATCH_DISPATCH: false
  }

  const { lastRFID, startListening: startRFID, stopListening: stopRFID } = useRFID({
    onDetect: (rfidUid) => {
      if (listening) {
        const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid
        setScannedRfid(normalizedRfid)
        setListening(false)
        stopRFID()
        handleRFIDExit(normalizedRfid)
      }
    }
  })

  const handleStartScan = () => {
    setListening(true)
    startRFID()
    setError('')
    setScannedRfid(null)
  }

  const handleStopScan = () => {
    setListening(false)
    stopRFID()
  }

  const handleRFIDExit = async (rfidUid) => {
    if (processing) return

    try {
      setProcessing(true)
      setError('')
      
      const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid.toUpperCase().trim()
      
      // Buscar lotes que tengan este RFID
      // El backend busca en product_batches.rfid_uid Y en batch_rfid_tags.rfid_uid
      // Si devuelve lotes, significa que el RFID está asociado al lote de alguna forma
      const batchResponse = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
      const batches = batchResponse.data.data || []
      
      // Si el backend devuelve lotes, significa que encontró el RFID
      // Tomamos el primer lote con stock activo (el backend ya filtró por RFID)
      const batch = batches.find(b => b.quantity > 0) || batches[0]

      if (!batch) {
        setError('Lote no encontrado para este tag RFID. Verifica que el IDP esté registrado en el sistema.')
        setProcessing(false)
        return
      }

      if (batch.quantity <= 0) {
        setError(`Stock insuficiente en este lote. Stock disponible: ${batch.quantity} unidades`)
        setProcessing(false)
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
      setQuantity(1)
      setError('')
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
      
      const qty = parseInt(quantity) || 1
      
      let areaIdValue = null
      if (area_id) {
        if (typeof area_id === 'string' && area_id.trim() !== '') {
          areaIdValue = parseInt(area_id) || null
        } else if (typeof area_id === 'number') {
          areaIdValue = area_id
        }
      }
      const area = areaIdValue

      // Validación: No permitir salida de lotes vencidos
      if (!VALIDATION_RULES.ALLOW_EXPIRED_BATCH_DISPATCH && isExpired) {
        setError('El lote está vencido. No se permite despachar medicamentos vencidos.')
        setProcessing(false)
        return
      }
      
      // Validar cantidad
      if (qty < VALIDATION_RULES.MIN_QUANTITY) {
        setError('La cantidad debe ser mayor a 0')
        setProcessing(false)
        return
      }

      if (qty > VALIDATION_RULES.MAX_QUANTITY_PER_OPERATION) {
        setError(`La cantidad máxima permitida es ${VALIDATION_RULES.MAX_QUANTITY_PER_OPERATION} unidades`)
        setProcessing(false)
        return
      }
      
      if (qty > currentBatch.quantity) {
        setError(`Stock insuficiente. Disponible: ${currentBatch.quantity} unidades`)
        setProcessing(false)
        return
      }
      
      const response = await api.post('/stock/exit', {
        rfid_uid: currentBatch.rfid_uid,
        quantity: qty,
        area_id: area
      })

      const areaName = areas.find(a => a.id === area)?.name || 'No especificada'
      const remainingStock = response.data?.data?.batch?.quantity || response.data?.data?.remaining_stock || (currentBatch.quantity - qty)

      setLastProcessed({
        product: currentProduct.name,
        quantity: qty,
        area: areaName,
        message: response.data?.data?.message || response.data?.message || 'Salida registrada correctamente',
        remaining_stock: remainingStock
      })

      // Limpiar formulario
      setCurrentProduct(null)
      setCurrentBatch(null)
      setScannedRfid(null)
      setQuantity(1)
      setArea_id(null)
      setError('')
      
      // Invalidar queries
      queryClient.invalidateQueries(['products'])
      queryClient.invalidateQueries(['batches'])
      queryClient.invalidateQueries(['stock'])

      // Limpiar mensaje después de 4 segundos
      setTimeout(() => {
        setLastProcessed(null)
      }, 4000)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar salida')
    } finally {
      setProcessing(false)
    }
  }

  const remainingStock = currentBatch && quantity ? currentBatch.quantity - quantity : currentBatch?.quantity || 0

  return (
    <div className="stock-exit-page">
      <div className="page-header">
        <div>
          <h1>Salida de Stock</h1>
          <p className="page-subtitle">Escanear IDP para registrar retiro de medicamentos</p>
        </div>
      </div>

      <Card shadow="md" className="exit-card">
        <div className="exit-content">
          {/* Paso 1: Escanear IDP */}
          <div className="rfid-scan-section">
            <h3><span className="step-number">1</span> Escanear IDP</h3>
            <div className="scan-controls">
              <Button
                variant={listening ? 'danger' : 'primary'}
                size="lg"
                onClick={listening ? handleStopScan : handleStartScan}
                disabled={processing || (currentProduct && !lastProcessed)}
                fullWidth
              >
                {listening ? <HiStop /> : <HiWifi />}
                {listening ? 'Detener Escaneo' : 'Iniciar Escaneo IDP'}
              </Button>
              
              {listening && (
                <div className="rfid-status">
                  <span className="rfid-indicator pulse"></span>
                  <span>Esperando IDP... Acerca el tag</span>
                  {lastRFID && (
                    <span className="last-rfid">Detectado: {formatRfidCode(lastRFID.uid)}</span>
                  )}
                </div>
              )}

              {scannedRfid && !listening && (
                <div className="scanned-rfid">
                  <Badge variant="success" size="lg">
                    IDP Escaneado: {formatRfidCode(scannedRfid)}
                  </Badge>
                </div>
              )}

              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Paso 2: Confirmar Retiro */}
          {currentProduct && currentBatch && !lastProcessed && (
            <div className="confirm-section">
              <h3><span className="step-number">2</span> Confirmar Retiro</h3>
              
              {/* Información del Producto */}
              <div className="product-info-card">
                <div className="product-header">
                  <div>
                    <h4>{currentProduct.name}</h4>
                    {currentProduct.active_ingredient && (
                      <p className="product-detail">{currentProduct.active_ingredient}</p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCurrentProduct(null)
                      setCurrentBatch(null)
                      setScannedRfid(null)
                      setQuantity(1)
                      setError('')
                    }}
                  >
                    <HiX /> Cambiar
                  </Button>
                </div>
                
                <div className="product-badges">
                  <Badge variant="info" size="sm">
                    Stock: {currentBatch.quantity} unidades
                  </Badge>
                  {currentBatch.lot_number && (
                    <Badge variant="secondary" size="sm">
                      Lote: {currentBatch.lot_number}
                    </Badge>
                  )}
                  {currentBatch.expiry_date && (
                    <Badge variant={isExpired ? 'danger' : isExpiringSoon ? 'warning' : 'info'} size="sm">
                      {isExpired ? (
                        <> <HiExclamation /> Vencido</>
                      ) : isExpiringSoon ? (
                        <> <HiExclamation /> Vence en {daysToExpiry} días</>
                      ) : (
                        <>Vence: {new Date(currentBatch.expiry_date).toLocaleDateString('es-ES')}</>
                      )}
                    </Badge>
                  )}
                </div>

                {isExpired && (
                  <div className="error-message" style={{ marginTop: '1rem' }}>
                    <HiExclamation /> <strong>Error:</strong> El lote está vencido. No se permite despachar medicamentos vencidos.
                  </div>
                )}

                {isExpiringSoon && !isExpired && (
                  <div className="warning-message" style={{ marginTop: '1rem' }}>
                    <HiExclamation /> <strong>Advertencia:</strong> Este producto vence pronto (en {daysToExpiry} días).
                  </div>
                )}
              </div>

              {/* Formulario de Retiro */}
              <div className="exit-form">
                <Input
                  label="Cantidad a Retirar"
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
                  error={error && error.includes('cantidad') ? error : ''}
                  helperText={`Máximo: ${currentBatch.quantity} unidades disponibles`}
                  disabled={processing || isExpired}
                />

                {areas.length > 0 && (
                  <div className="area-selector">
                    <label>Área de Destino (Opcional)</label>
                    <select
                      value={area_id || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setArea_id(value === '' ? null : (parseInt(value) || null))
                      }}
                      disabled={processing || isExpired}
                      className="area-select-input"
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

                {/* Calculadora de Stock Restante */}
                {quantity > 0 && (
                  <div className="stock-remaining-calculator">
                    <div className="calc-header">
                      <span>📊</span> Stock Restante:
                    </div>
                    <div className="calc-result">
                      {currentBatch.quantity} - {quantity} = <span className="total-number">{remainingStock}</span> unidades
                    </div>
                  </div>
                )}

                {error && !error.includes('cantidad') && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                <div className="exit-actions">
                  <Button
                    variant="primary"
                    onClick={processExit}
                    loading={processing}
                    disabled={processing || quantity <= 0 || isExpired || quantity > currentBatch.quantity}
                    fullWidth
                  >
                    <HiCheckCircle /> Confirmar Retiro
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje de éxito */}
          {lastProcessed && (
            <div className="success-message">
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

          {processing && !currentProduct && (
            <div className="processing-status">
              <Loading size="sm" text="Procesando..." />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
