import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRFID } from '../hooks/useRFID'
import api from '../services/api'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Modal from '../components/common/Modal'
import Input from '../components/common/Input'
import Loading from '../components/common/Loading'
import { HiArrowUp, HiWifi, HiStop, HiCheckCircle } from 'react-icons/hi'
import './StockExit.css'

export default function StockExit() {
  const queryClient = useQueryClient()
  const [processing, setProcessing] = useState(false)
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [currentBatch, setCurrentBatch] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [areaId, setAreaId] = useState('')
  const [areas, setAreas] = useState([])
  const [lastProcessed, setLastProcessed] = useState(null)
  const [error, setError] = useState('')

  const handleRFIDExit = async (rfidUid) => {
    if (processing) return

    try {
      setProcessing(true)
      setError('')
      
      const productResponse = await api.get(`/products/by-rfid/${rfidUid}`)
      const product = productResponse.data.data

      if (!product) {
        setError('Medicamento no encontrado para este tag')
        return
      }

      const batchResponse = await api.get(`/batches?rfid_uid=${rfidUid}`)
      const batches = batchResponse.data.data || []
      const batch = batches.find(b => b.rfid_uid === rfidUid)

      if (!batch) {
        setError('Lote no encontrado para este tag')
        return
      }

      if (batch.quantity <= 0) {
        setError('Stock insuficiente en este lote')
        return
      }

      setCurrentProduct(product)
      setCurrentBatch(batch)

      // Cargar áreas
      try {
        const areasResponse = await api.get('/areas')
        setAreas(areasResponse.data.data || [])
      } catch {
        setAreas([])
      }

      if (product.units_per_package > 1) {
        setQuantity(1)
        setShowQuantityModal(true)
      } else {
        await processExit(rfidUid, 1, areaId || null)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al buscar medicamento')
    } finally {
      setProcessing(false)
    }
  }

  const processExit = async (rfidUid, qty, area) => {
    try {
      setProcessing(true)
      setError('')
      
      if (qty > currentBatch.quantity) {
        setError(`Cantidad excede el stock disponible (${currentBatch.quantity})`)
        return
      }
      
      const response = await api.post('/stock/exit', {
        rfid_uid: rfidUid,
        quantity: qty,
        area_id: area || null
      })

      setLastProcessed({
        product: currentProduct?.name || 'Medicamento',
        quantity: qty,
        area: areas.find(a => a.id === area)?.name || 'N/A',
        message: response.data.data?.message || 'Salida registrada correctamente'
      })

      setShowQuantityModal(false)
      setCurrentProduct(null)
      setCurrentBatch(null)
      setAreaId('')
      queryClient.invalidateQueries(['products'])
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar salida')
    } finally {
      setProcessing(false)
    }
  }

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
              <li>Si es una caja, especifica la cantidad a retirar</li>
              <li>Selecciona el área de destino (opcional)</li>
              <li>Confirma la salida de stock</li>
            </ul>
          </div>

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
                <span>Detección por proximidad activa</span>
                {lastRFID && (
                  <span className="last-rfid">Detectado: {lastRFID.uid}</span>
                )}
              </div>
            )}

            {processing && (
              <div className="processing-status">
                <Loading size="sm" text="Procesando salida..." />
              </div>
            )}

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {lastProcessed && (
              <div className="success-message">
                <HiCheckCircle />
                <div>
                  <strong>Salida registrada</strong>
                  <p>Medicamento: {lastProcessed.product}</p>
                  <p>Cantidad: {lastProcessed.quantity} unidades</p>
                  {lastProcessed.area && <p>Área: {lastProcessed.area}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showQuantityModal}
        onClose={() => {
          setShowQuantityModal(false)
          setCurrentProduct(null)
          setCurrentBatch(null)
          setAreaId('')
        }}
        title="Especificar Cantidad y Área"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowQuantityModal(false)
                setCurrentProduct(null)
                setCurrentBatch(null)
                setAreaId('')
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => processExit(currentBatch?.rfid_uid, quantity, areaId || null)}
              loading={processing}
            >
              Confirmar Salida
            </Button>
          </>
        }
      >
        {currentProduct && currentBatch && (
          <div className="quantity-modal-content">
            <div className="product-info">
              <h4>{currentProduct.name}</h4>
              <p>Stock disponible: {currentBatch.quantity} unidades</p>
              <p>Cantidad faltante: {currentProduct.units_per_package > 1 ? 'Especificar' : '1 unidad'}</p>
            </div>
            <Input
              label="Cantidad a Retirar"
              type="number"
              min="1"
              max={currentBatch.quantity}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              helperText={`Máximo: ${currentBatch.quantity} unidades`}
            />
            {areas.length > 0 && (
              <div className="form-group">
                <label>Área de Destino (Opcional)</label>
                <select
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="input"
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
          </div>
        )}
      </Modal>
    </div>
  )
}
