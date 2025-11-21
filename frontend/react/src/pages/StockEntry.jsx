import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRFID } from '../hooks/useRFID'
import api from '../services/api'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Modal from '../components/common/Modal'
import Input from '../components/common/Input'
import Loading from '../components/common/Loading'
import Table from '../components/common/Table'
import Badge from '../components/common/Badge'
import { formatRfidCode, normalizeRfidCode } from '../utils/formatting'
import { HiArrowDown, HiWifi, HiStop, HiCheckCircle, HiPlus, HiTrash, HiX, HiSearch } from 'react-icons/hi'
import './StockEntry.css'

// Hook para debounce
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export default function StockEntry() {
  const queryClient = useQueryClient()
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [searchProduct, setSearchProduct] = useState('')
  const [debouncedSearchProduct, setDebouncedSearchProduct] = useState('')
  const [listening, setListening] = useState(false)
  const [scannedRfid, setScannedRfid] = useState(null)
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [batchData, setBatchData] = useState({
    lot_number: '',
    expiry_date: '',
    quantity: 1
  })
  const [errors, setErrors] = useState({})
  const [processing, setProcessing] = useState(false)
  const [multipleMode, setMultipleMode] = useState(false)
  const [pendingEntries, setPendingEntries] = useState([])
  const [lastProcessed, setLastProcessed] = useState(null)

  // Debounce para búsqueda de productos
  const debouncedProductSearch = useDebounce(searchProduct, 300)

  useEffect(() => {
    setDebouncedSearchProduct(debouncedProductSearch)
  }, [debouncedProductSearch])

  // Buscar productos del catálogo
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-catalog', debouncedSearchProduct],
    queryFn: async () => {
      if (!debouncedSearchProduct.trim()) return []
      const params = new URLSearchParams()
      params.append('search', debouncedSearchProduct.trim())
      params.append('limit', '20')
      
      try {
        const response = await api.get(`/products/catalog?${params.toString()}`)
        return response.data.data || []
      } catch {
        return []
      }
    },
    enabled: !!debouncedSearchProduct.trim()
  })

  // Hook RFID
  const { lastRFID, startListening: startRFID, stopListening: stopRFID } = useRFID({
    onDetect: (rfidUid) => {
      if (selectedProduct && listening) {
        const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid
        setScannedRfid(normalizedRfid)
        setListening(false)
        stopRFID()
        setShowBatchForm(true)
      }
    }
  })

  const handleSelectProduct = (product) => {
    setSelectedProduct(product)
    setSearchProduct('')
    setScannedRfid(null)
    setShowBatchForm(false)
    setBatchData({
      lot_number: '',
      expiry_date: '',
      quantity: 1
    })
    setErrors({})
    setPendingEntries([])
  }

  const handleStartScan = () => {
    if (!selectedProduct) {
      setErrors({ product: 'Debes seleccionar un producto primero' })
      return
    }
    setListening(true)
    startRFID()
    setErrors({})
  }

  const handleStopScan = () => {
    setListening(false)
    stopRFID()
  }

  const handleAddBatch = () => {
    // Validar campos
    const newErrors = {}
    if (!batchData.lot_number.trim()) {
      newErrors.lot_number = 'El número de lote es requerido'
    }
    if (!batchData.expiry_date) {
      newErrors.expiry_date = 'La fecha de vencimiento es requerida'
    }
    if (!batchData.quantity || batchData.quantity < 1) {
      newErrors.quantity = 'La cantidad debe ser mayor a 0'
    }
    if (!scannedRfid) {
      newErrors.rfid = 'Debes escanear un RFID primero'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (multipleMode) {
      // Agregar a lista pendiente
      const entry = {
        id: Date.now(),
        product: selectedProduct,
        rfid: scannedRfid,
        lot_number: batchData.lot_number.trim(),
        expiry_date: batchData.expiry_date,
        quantity: parseInt(batchData.quantity)
      }
      setPendingEntries([...pendingEntries, entry])
      
      // Limpiar formulario para siguiente entrada
      setBatchData({
        lot_number: '',
        expiry_date: '',
        quantity: 1
      })
      setScannedRfid(null)
      setErrors({})
    } else {
      // Procesar inmediatamente
      processBatch({
        product_id: selectedProduct.id,
        rfid_uid: scannedRfid,
        lot_number: batchData.lot_number.trim(),
        expiry_date: batchData.expiry_date,
        quantity: parseInt(batchData.quantity)
      })
    }
  }

  const processBatch = async (batchDataToProcess) => {
    try {
      setProcessing(true)
      setErrors({})

      const normalizedRfid = normalizeRfidCode(batchDataToProcess.rfid_uid) || batchDataToProcess.rfid_uid
      
      const response = await api.post('/batches', {
        ...batchDataToProcess,
        rfid_uid: normalizedRfid
      })

      setLastProcessed({
        product: selectedProduct?.name || 'Medicamento',
        quantity: batchDataToProcess.quantity,
        message: 'Lote creado correctamente'
      })

      // Limpiar formulario
      setShowBatchForm(false)
      setBatchData({
        lot_number: '',
        expiry_date: '',
        quantity: 1
      })
      setScannedRfid(null)
      
      // Invalidar queries
      queryClient.invalidateQueries(['batches'])
      queryClient.invalidateQueries(['stock'])
      queryClient.invalidateQueries(['products'])

      // Limpiar después de 3 segundos
      setTimeout(() => {
        setLastProcessed(null)
        if (!multipleMode) {
          setSelectedProduct(null)
        }
      }, 3000)
    } catch (err) {
      setErrors({
        submit: err.response?.data?.error || 'Error al crear el lote'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirmMultiple = async () => {
    if (pendingEntries.length === 0) return

    try {
      setProcessing(true)
      setErrors({})

      for (const entry of pendingEntries) {
        await processBatch({
          product_id: entry.product.id,
          rfid_uid: entry.rfid,
          lot_number: entry.lot_number,
          expiry_date: entry.expiry_date,
          quantity: entry.quantity
        })
      }

      setPendingEntries([])
      setSelectedProduct(null)
      setShowBatchForm(false)
      setMultipleMode(false)
    } catch (err) {
      setErrors({
        submit: err.response?.data?.error || 'Error al procesar las entradas'
      })
    } finally {
      setProcessing(false)
    }
  }

  const removePendingEntry = (id) => {
    setPendingEntries(pendingEntries.filter(e => e.id !== id))
  }

  const pendingColumns = [
    {
      key: 'product',
      header: 'Producto',
      render: (_, row) => row.product.name
    },
    {
      key: 'rfid',
      header: 'RFID',
      render: (_, row) => formatRfidCode(row.rfid)
    },
    {
      key: 'lot_number',
      header: 'Lote',
      render: (_, row) => row.lot_number
    },
    {
      key: 'expiry_date',
      header: 'Vencimiento',
      render: (_, row) => new Date(row.expiry_date).toLocaleDateString('es-ES')
    },
    {
      key: 'quantity',
      header: 'Cantidad',
      render: (_, row) => (
        <Badge variant="success" size="sm">{row.quantity}</Badge>
      )
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (_, row) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => removePendingEntry(row.id)}
        >
          <HiTrash />
        </Button>
      )
    }
  ]

  return (
    <div className="stock-entry-page">
      <div className="page-header">
        <div>
          <h1>Entrada de Stock</h1>
          <p className="page-subtitle">Seleccionar producto y escanear RFID para registrar ingreso</p>
        </div>
      </div>

      <Card shadow="md" className="entry-card">
        <div className="entry-content">
          {/* Selección de Producto */}
          <div className="product-selection-section">
            <h3>1. Seleccionar Producto</h3>
            {!selectedProduct ? (
              <div>
                <Input
                  placeholder="Buscar producto por nombre..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  icon={<HiSearch />}
                />
                {loadingProducts && (
                  <Loading size="sm" text="Buscando productos..." />
                )}
                {products && products.length > 0 && (
                  <div className="products-list">
                    {products.slice(0, 10).map((product) => (
                      <div
                        key={product.id}
                        className="product-item"
                        onClick={() => handleSelectProduct(product)}
                      >
                        <div>
                          <strong>{product.name}</strong>
                          {product.active_ingredient && (
                            <span className="product-detail">{product.active_ingredient}</span>
                          )}
                        </div>
                        <Badge variant={product.product_type === 'medicamento' ? 'primary' : 'info'} size="sm">
                          {product.product_type === 'medicamento' ? 'Medicamento' : 'Insumo'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {products && products.length === 0 && debouncedSearchProduct.trim() && (
                  <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No se encontraron productos
                  </p>
                )}
              </div>
            ) : (
              <div className="selected-product">
                <div>
                  <strong>{selectedProduct.name}</strong>
                  {selectedProduct.active_ingredient && (
                    <span className="product-detail"> - {selectedProduct.active_ingredient}</span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedProduct(null)
                    setScannedRfid(null)
                    setShowBatchForm(false)
                    setBatchData({ lot_number: '', expiry_date: '', quantity: 1 })
                    setErrors({})
                    setPendingEntries([])
                    setMultipleMode(false)
                  }}
                >
                  <HiX />
                  Cambiar Producto
                </Button>
              </div>
            )}
          </div>

          {/* Escaneo RFID */}
          {selectedProduct && (
            <div className="rfid-scan-section">
              <h3>2. Escanear RFID</h3>
              <div className="scan-controls">
                <Button
                  variant={listening ? 'danger' : 'primary'}
                  size="lg"
                  onClick={listening ? handleStopScan : handleStartScan}
                  disabled={processing}
                  fullWidth
                >
                  {listening ? <HiStop /> : <HiWifi />}
                  {listening ? 'Detener Escaneo' : 'Iniciar Escaneo RFID'}
                </Button>
                
                {listening && (
                  <div className="rfid-status">
                    <span className="rfid-indicator pulse"></span>
                    <span>Esperando RFID... Acerca el tag</span>
                    {lastRFID && (
                      <span className="last-rfid">Detectado: {formatRfidCode(lastRFID.uid)}</span>
                    )}
                  </div>
                )}

                {scannedRfid && !listening && (
                  <div className="scanned-rfid">
                    <Badge variant="success" size="lg">
                      RFID Escaneado: {formatRfidCode(scannedRfid)}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulario de Lote */}
          {selectedProduct && scannedRfid && (
            <div className="batch-form-section">
              <h3>3. Ingresar Datos del Lote</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={multipleMode}
                    onChange={(e) => {
                      setMultipleMode(e.target.checked)
                      if (!e.target.checked) {
                        setPendingEntries([])
                      }
                    }}
                  />
                  <span>Modo múltiple (agregar varios medicamentos con el mismo RFID)</span>
                </label>
              </div>
              
              <div className="batch-form">
                <Input
                  label="Número de Lote"
                  value={batchData.lot_number}
                  onChange={(e) => {
                    setBatchData({ ...batchData, lot_number: e.target.value })
                    setErrors({ ...errors, lot_number: '' })
                  }}
                  error={errors.lot_number}
                  placeholder="Ej: LOT-2025-001"
                />
                <Input
                  label="Fecha de Vencimiento"
                  type="date"
                  value={batchData.expiry_date}
                  onChange={(e) => {
                    setBatchData({ ...batchData, expiry_date: e.target.value })
                    setErrors({ ...errors, expiry_date: '' })
                  }}
                  error={errors.expiry_date}
                />
                <Input
                  label="Cantidad"
                  type="number"
                  min="1"
                  value={batchData.quantity}
                  onChange={(e) => {
                    setBatchData({ ...batchData, quantity: parseInt(e.target.value) || 1 })
                    setErrors({ ...errors, quantity: '' })
                  }}
                  error={errors.quantity}
                />
              </div>

              {errors.submit && (
                <div className="error-message" role="alert">
                  {errors.submit}
                </div>
              )}

              <div className="batch-actions">
                <Button
                  variant="primary"
                  onClick={handleAddBatch}
                  loading={processing}
                  disabled={processing}
                >
                  <HiPlus />
                  {multipleMode ? 'Agregar a Lista' : 'Crear Lote'}
                </Button>
              </div>
            </div>
          )}

          {/* Lista de Entradas Pendientes */}
          {multipleMode && pendingEntries.length > 0 && (
            <div className="pending-entries-section">
              <h3>Entradas Pendientes ({pendingEntries.length})</h3>
              <Table
                columns={pendingColumns}
                data={pendingEntries}
                emptyMessage="No hay entradas pendientes"
              />
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPendingEntries([])
                    setMultipleMode(false)
                  }}
                >
                  Limpiar Lista
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmMultiple}
                  loading={processing}
                  disabled={processing}
                >
                  <HiCheckCircle />
                  Confirmar Todas ({pendingEntries.length})
                </Button>
              </div>
            </div>
          )}

          {/* Mensaje de éxito */}
          {lastProcessed && (
            <div className="success-message">
              <HiCheckCircle />
              <div>
                <strong>Entrada registrada</strong>
                <p>Medicamento: {lastProcessed.product}</p>
                <p>Cantidad: {lastProcessed.quantity} unidades</p>
              </div>
            </div>
          )}

          {processing && (
            <div className="processing-status">
              <Loading size="sm" text="Procesando entrada..." />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
