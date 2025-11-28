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
import { HiWifi, HiStop, HiCheckCircle, HiPlus, HiTrash, HiX, HiSearch, HiRefresh, HiCube } from 'react-icons/hi'
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
    quantity: 1,
    boxes: 1
  })
  const [entryMode, setEntryMode] = useState('boxes')
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
      if (!debouncedProductSearch.trim()) return []
      const params = new URLSearchParams()
      params.append('search', debouncedProductSearch.trim())
      params.append('limit', '20')
      
      try {
        const response = await api.get(`/products/catalog?${params.toString()}`)
        return response.data.data || []
      } catch {
        return []
      }
    },
    enabled: !!debouncedProductSearch.trim()
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
    const unitsPerBox = product?.units_per_package || 1
    setBatchData({
      lot_number: '',
      expiry_date: '',
      quantity: unitsPerBox,
      boxes: 1
    })
    setEntryMode(unitsPerBox > 1 ? 'boxes' : 'units')
    setErrors({})
    setPendingEntries([])
  }

  const calculateTotalQuantity = () => {
    const unitsPerBox = selectedProduct?.units_per_package || 1
    if (entryMode === 'boxes' && unitsPerBox > 1) {
      return (batchData.boxes || 1) * unitsPerBox
    }
    return batchData.quantity || 1
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

  const VALIDATION_RULES = {
    MIN_QUANTITY: 1,
    MAX_QUANTITY_PER_OPERATION: 10000
  }

  const handleAddBatch = async () => {
    const newErrors = {}
    if (!batchData.lot_number.trim()) {
      newErrors.lot_number = 'El número de lote es requerido'
    }
    if (!batchData.expiry_date) {
      newErrors.expiry_date = 'La fecha de vencimiento es requerida'
    } else {
      const expiryDate = new Date(batchData.expiry_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (expiryDate < today) {
        newErrors.expiry_date = 'La fecha de vencimiento no puede ser anterior a hoy'
      }
    }
    
    const quantityValue = calculateTotalQuantity()
    if (!quantityValue || quantityValue < VALIDATION_RULES.MIN_QUANTITY || isNaN(quantityValue)) {
      newErrors.quantity = 'La cantidad debe ser un número mayor a 0'
    } else if (quantityValue > VALIDATION_RULES.MAX_QUANTITY_PER_OPERATION) {
      newErrors.quantity = `La cantidad máxima permitida es ${VALIDATION_RULES.MAX_QUANTITY_PER_OPERATION} unidades`
    }
    
    if (!scannedRfid) {
      newErrors.rfid = 'Debes escanear un IDP primero'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    if (multipleMode) {
      const normalizedScannedRfid = normalizeRfidCode(scannedRfid) || scannedRfid
      const isDuplicateInList = pendingEntries.some(e => {
        const normalizedEntryRfid = normalizeRfidCode(e.rfid) || e.rfid
        return normalizedEntryRfid === normalizedScannedRfid
      })
      
      if (isDuplicateInList) {
        setErrors({ rfid: 'Este IDP ya está en la lista pendiente' })
        return
      }
      
      setProcessing(true)
      setErrors({})
      
      const validateRfidInDatabase = async () => {
        try {
          const normalizedRfid = normalizeRfidCode(scannedRfid) || scannedRfid
          const existingBatchResponse = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
          const existingBatches = existingBatchResponse.data.data || []
          
          if (existingBatches.length > 0) {
            const activeBatch = existingBatches.find(b => b.quantity > 0)
            
            if (activeBatch) {
              const isDifferentProduct = activeBatch.product_id !== selectedProduct.id
              
              if (isDifferentProduct) {
                const productName = activeBatch.product_name || 'Medicamento'
                const expiryDate = activeBatch.expiry_date 
                  ? new Date(activeBatch.expiry_date).toLocaleDateString('es-ES')
                  : 'N/A'
                
                setErrors({
                  rfid: `⚠️ IDP EN USO POR OTRO PRODUCTO: Este IDP ya está asignado a "${productName}". No puedes usarlo para "${selectedProduct.name}".\n\nDetalles: Stock ${activeBatch.quantity} unidades, Lote ${activeBatch.lot_number}, Vence ${expiryDate}`
                })
                setProcessing(false)
                return false
              }
            }
          }
          
          const totalQuantity = calculateTotalQuantity()
          const entry = {
            id: Date.now(),
            product: selectedProduct,
            rfid: scannedRfid,
            lot_number: batchData.lot_number.trim(),
            expiry_date: batchData.expiry_date,
            quantity: totalQuantity,
            boxes: batchData.boxes || 1,
            entryMode: entryMode
          }
          setPendingEntries([...pendingEntries, entry])
          
          setScannedRfid(null)
          setErrors({})
          setProcessing(false)
          
          return true
        } catch (checkError) {
          if (checkError.response?.status === 400) {
            const errorMessage = checkError.response?.data?.error || 'Error al verificar RFID'
            setErrors({ rfid: errorMessage })
            setProcessing(false)
            return false
          }
          console.warn('Error al verificar RFID existente:', checkError)
          setErrors({ 
            rfid: '⚠️ No se pudo verificar si el RFID ya existe. Verifica manualmente antes de confirmar.' 
          })
          setProcessing(false)
          return false
        }
      }
      
      await validateRfidInDatabase()
    } else {
      const totalQuantity = calculateTotalQuantity()
      processBatch({
        product_id: selectedProduct.id,
        rfid_uid: scannedRfid,
        lot_number: batchData.lot_number.trim(),
        expiry_date: batchData.expiry_date,
        quantity: totalQuantity
      })
    }
  }

  const processBatch = async (batchDataToProcess) => {
    try {
      setProcessing(true)
      setErrors({})

      const normalizedRfid = normalizeRfidCode(batchDataToProcess.rfid_uid) || batchDataToProcess.rfid_uid
      
      try {
        const existingBatchResponse = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
        const existingBatches = existingBatchResponse.data.data || []
        
        if (existingBatches.length > 0) {
          const activeBatch = existingBatches.find(b => b.quantity > 0)
          
          if (activeBatch) {
            const isDifferentProduct = activeBatch.product_id !== selectedProduct.id
            
            if (isDifferentProduct) {
              const productName = activeBatch.product_name || 'Medicamento'
              const expiryDate = activeBatch.expiry_date 
                ? new Date(activeBatch.expiry_date).toLocaleDateString('es-ES')
                : 'N/A'
              
              setErrors({
                rfid: `⚠️ IDP EN USO POR OTRO PRODUCTO: Este IDP (${formatRfidCode(normalizedRfid)}) ya está asignado a "${productName}". No puedes usarlo para "${selectedProduct.name}".\n\nDetalles del lote existente:\n- Stock actual: ${activeBatch.quantity} unidades\n- Lote: ${activeBatch.lot_number}\n- Vence: ${expiryDate}`
              })
              setProcessing(false)
              return
            }
          }
        }
      } catch (checkError) {
        if (checkError.response?.status !== 400) {
          console.warn('Error al verificar RFID existente:', checkError)
        }
      }
      
      const response = await api.post('/batches', {
        ...batchDataToProcess,
        rfid_uid: normalizedRfid
      })

      const isStockAdded = response.data?.action === 'stock_added'
      const successMessage = response.data?.message || 'Lote creado correctamente'

      setLastProcessed({
        product: selectedProduct?.name || 'Medicamento',
        quantity: batchDataToProcess.quantity,
        message: successMessage,
        action: response.data?.action || 'batch_created',
        previous_quantity: response.data?.previous_quantity || null,
        added_quantity: response.data?.added_quantity || null,
        new_quantity: response.data?.new_quantity || null
      })

      if (listening) {
        setListening(false)
        stopRFID()
      }
      
      setShowBatchForm(false)
      const unitsPerBox = selectedProduct?.units_per_package || 1
      setBatchData({
        lot_number: '',
        expiry_date: '',
        quantity: unitsPerBox,
        boxes: 1
      })
      setScannedRfid(null)
      
      queryClient.invalidateQueries(['batches'])
      queryClient.invalidateQueries(['stock'])
      queryClient.invalidateQueries(['products'])

      setTimeout(() => {
        setLastProcessed(null)
        if (!multipleMode) {
          setSelectedProduct(null)
        }
      }, 4000)
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al crear el lote'
      const batchInfo = err.response?.data?.batch_info || null
      
      if (errorMessage.includes('IDP') || errorMessage.includes('RFID') || 
          errorMessage.includes('DUPLICADO') || errorMessage.includes('ya está registrado')) {
        let rfidError = errorMessage
        
        if (batchInfo) {
          const expiryDate = batchInfo.expiry_date 
            ? new Date(batchInfo.expiry_date).toLocaleDateString('es-ES')
            : 'N/A'
          
          rfidError = `⚠️ ${errorMessage}\n\n📋 Detalles del lote existente:\n• Producto: ${batchInfo.product_name || 'N/A'}\n• Stock: ${batchInfo.quantity || 0} unidades\n• Lote: ${batchInfo.lot_number || 'N/A'}\n• Vence: ${expiryDate}`
        }
        
        setErrors({ rfid: rfidError })
      } else {
        setErrors({ submit: errorMessage })
      }
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
        const quantityValue = parseInt(entry.quantity) || 1
        await processBatch({
          product_id: entry.product.id,
          rfid_uid: entry.rfid,
          lot_number: entry.lot_number,
          expiry_date: entry.expiry_date,
          quantity: quantityValue
        })
      }

      if (listening) {
        setListening(false)
        stopRFID()
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
      header: 'IDP',
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
      render: (_, row) => {
        const unitsPerBox = row.product?.units_per_package || 1
        if (row.entryMode === 'boxes' && unitsPerBox > 1) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <Badge variant="success" size="sm">{row.quantity} unidades</Badge>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                ({row.boxes} caja{row.boxes > 1 ? 's' : ''} × {unitsPerBox})
              </span>
            </div>
          )
        }
        return <Badge variant="success" size="sm">{row.quantity} unidades</Badge>
      }
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
      <div className="stock-entry-header">
        <h1>Entrada de Stock</h1>
        <p className="stock-entry-subtitle">Registrar ingreso de medicamentos mediante escaneo de IDP</p>
      </div>

      <div className="stock-entry-workflow">
        {/* PASO 1: Seleccionar Producto */}
        <div className="stock-entry-step">
          <div className="stock-entry-step-header">
            <div className="step-number-circle">1</div>
            <h2 className="stock-entry-step-title">Seleccionar Producto</h2>
          </div>
          
          {!selectedProduct ? (
            <div className="product-search-wrapper">
              <Input
                placeholder="Buscar producto por nombre..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                icon={<HiSearch />}
              />
              
              {loadingProducts && (
                <div style={{ marginTop: '1rem' }}>
                  <Loading size="sm" text="Buscando productos..." />
                </div>
              )}
              
              {products && products.length > 0 && (
                <div className="products-dropdown">
                  {products.slice(0, 10).map((product) => (
                    <div
                      key={product.id}
                      className="product-option"
                      onClick={() => handleSelectProduct(product)}
                    >
                      <div>
                        <div className="product-option-name">{product.name}</div>
                        <div className="product-option-details">
                          {product.active_ingredient && <span>{product.active_ingredient}</span>}
                          {product.presentation && <span> · {product.presentation}</span>}
                          {product.units_per_package > 1 && <span> · {product.units_per_package} unidades/caja</span>}
                        </div>
                      </div>
                      <Badge variant={product.product_type === 'medicamento' ? 'primary' : 'info'} size="sm">
                        {product.product_type === 'medicamento' ? 'Medicamento' : 'Insumo'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              
              {products && products.length === 0 && debouncedSearchProduct.trim() && (
                <div style={{ marginTop: '1rem', padding: '1rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                  No se encontraron productos
                </div>
              )}
            </div>
          ) : (
            <div className="selected-product-badge">
              <div className="selected-product-badge-icon">
                <HiCheckCircle />
              </div>
              <div className="selected-product-info">
                <h4>{selectedProduct.name}</h4>
                {selectedProduct.active_ingredient && (
                  <p>{selectedProduct.active_ingredient}</p>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (listening) {
                    setListening(false)
                    stopRFID()
                  }
                  setSelectedProduct(null)
                  setScannedRfid(null)
                  setShowBatchForm(false)
                  setBatchData({ lot_number: '', expiry_date: '', quantity: 1, boxes: 1 })
                  setEntryMode('boxes')
                  setErrors({})
                  setPendingEntries([])
                  setMultipleMode(false)
                }}
              >
                <HiX /> Cambiar
              </Button>
            </div>
          )}
        </div>

        {/* PASO 2: Escanear IDP */}
        {selectedProduct && (
          <div className="stock-entry-step">
            <div className="stock-entry-step-header">
              <div className="step-number-circle">2</div>
              <h2 className="stock-entry-step-title">Escanear IDP</h2>
            </div>
            
            <Button
              variant={listening ? 'danger' : 'primary'}
              size="lg"
              onClick={listening ? handleStopScan : handleStartScan}
              disabled={processing}
              fullWidth
            >
              {listening ? <HiStop /> : <HiWifi />}
              {listening ? 'Detener Escaneo' : 'Iniciar Escaneo IDP'}
            </Button>
            
            {listening && (
              <div className="scan-status-indicator">
                <span className="scan-status-dot"></span>
                <span className="scan-status-text">
                  Esperando IDP... Acerca el tag RFID al lector
                </span>
                {lastRFID && (
                  <span className="scan-status-text" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {formatRfidCode(lastRFID.uid)}
                  </span>
                )}
              </div>
            )}

            {scannedRfid && !listening && (
              <div className="scanned-rfid-badge">
                <HiCheckCircle />
                IDP Escaneado: {formatRfidCode(scannedRfid)}
              </div>
            )}
            
            {errors.rfid && (
              <div className="stock-entry-message message-error">
                <div className="message-icon">⚠️</div>
                <div className="message-content">
                  <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{errors.rfid}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 3: Ingresar Datos del Lote */}
        {selectedProduct && scannedRfid && (
          <div className="stock-entry-step">
            <div className="stock-entry-step-header">
              <div className="step-number-circle">3</div>
              <h2 className="stock-entry-step-title">Ingresar Datos del Lote</h2>
            </div>
            
            <div className="multiple-mode-checkbox">
              <input
                type="checkbox"
                id="multiple-mode"
                checked={multipleMode}
                onChange={(e) => {
                  setMultipleMode(e.target.checked)
                  if (!e.target.checked) {
                    setPendingEntries([])
                    if (listening) {
                      setListening(false)
                      stopRFID()
                    }
                  }
                }}
              />
              <label htmlFor="multiple-mode">Modo múltiple (agregar varios IDP del mismo producto)</label>
            </div>
            
            <div className="batch-form-grid">
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
              
              {selectedProduct?.units_per_package > 1 && (
                <div className="mode-selector-wrapper">
                  <label className="mode-selector-label">Modo de Ingreso:</label>
                  <div className="mode-buttons">
                    <button
                      type="button"
                      className={`mode-button ${entryMode === 'boxes' ? 'active' : ''}`}
                      onClick={() => {
                        setEntryMode('boxes')
                        const newQuantity = (batchData.boxes || 1) * selectedProduct.units_per_package
                        setBatchData({ ...batchData, quantity: newQuantity })
                      }}
                    >
                      <HiCube /> Por Cajas
                    </button>
                    <button
                      type="button"
                      className={`mode-button ${entryMode === 'units' ? 'active' : ''}`}
                      onClick={() => setEntryMode('units')}
                    >
                      💊 Por Unidades
                    </button>
                  </div>
                </div>
              )}

              {selectedProduct?.units_per_package > 1 && entryMode === 'boxes' && (
                <>
                  <Input
                    label={`Cantidad de Cajas (${selectedProduct.units_per_package} unidades por caja)`}
                    type="number"
                    min="1"
                    value={batchData.boxes}
                    onChange={(e) => {
                      const boxes = parseInt(e.target.value) || 1
                      const totalUnits = boxes * selectedProduct.units_per_package
                      setBatchData({ ...batchData, boxes, quantity: totalUnits })
                      setErrors({ ...errors, quantity: '' })
                    }}
                    error={errors.quantity}
                    placeholder="Ej: 5"
                  />
                  <div className="quantity-calculator">
                    {batchData.boxes || 1} × {selectedProduct.units_per_package} = <strong>{calculateTotalQuantity()}</strong> unidades
                  </div>
                </>
              )}

              {(selectedProduct?.units_per_package <= 1 || entryMode === 'units') && (
                <Input
                  label="Cantidad (unidades individuales)"
                  type="number"
                  min="1"
                  value={batchData.quantity}
                  onChange={(e) => {
                    const qty = parseInt(e.target.value) || 1
                    const boxes = selectedProduct?.units_per_package > 1 
                      ? Math.ceil(qty / selectedProduct.units_per_package) 
                      : 1
                    setBatchData({ ...batchData, quantity: qty, boxes })
                    setErrors({ ...errors, quantity: '' })
                  }}
                  error={errors.quantity}
                  placeholder="Ej: 100"
                />
              )}
              
              {errors.submit && (
                <div className="stock-entry-message message-error" style={{ gridColumn: '1 / -1' }}>
                  <div className="message-icon">⚠️</div>
                  <div className="message-content">
                    <p style={{ margin: 0 }}>{errors.submit}</p>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <Button
                  variant="primary"
                  onClick={handleAddBatch}
                  loading={processing}
                  disabled={processing}
                  fullWidth
                >
                  <HiPlus />
                  {multipleMode ? 'Agregar a Lista' : 'Crear Lote'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Entradas Pendientes */}
        {multipleMode && pendingEntries.length > 0 && (
          <div className="stock-entry-step pending-entries-section">
            <div className="stock-entry-step-header">
              <div className="step-number-circle" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}>
                {pendingEntries.length}
              </div>
              <h2 className="stock-entry-step-title">Entradas Pendientes</h2>
            </div>
            
            <Table
              columns={pendingColumns}
              data={pendingEntries}
              emptyMessage="No hay entradas pendientes"
            />
            
            <div className="pending-entries-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  if (listening) {
                    setListening(false)
                    stopRFID()
                  }
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

        {/* Mensajes de Éxito */}
        {lastProcessed && (
          <div className={`stock-entry-message ${lastProcessed.action === 'stock_added' ? 'message-stock-added' : 'message-success'}`}>
            {lastProcessed.action === 'stock_added' ? (
              <HiRefresh className="message-icon" />
            ) : (
              <HiCheckCircle className="message-icon" />
            )}
            <div className="message-content">
              <h4>
                {lastProcessed.action === 'stock_added' 
                  ? 'Stock Agregado al Lote Existente' 
                  : 'Nuevo Lote Creado'}
              </h4>
              <p>Medicamento: {lastProcessed.product}</p>
              
              {lastProcessed.action === 'stock_added' ? (
                <div className="message-summary">
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    <strong>+{lastProcessed.added_quantity}</strong> unidades agregadas
                  </p>
                  <p style={{ margin: 0 }}>
                    Stock anterior: {lastProcessed.previous_quantity} → <strong>Nuevo stock: {lastProcessed.new_quantity}</strong>
                  </p>
                </div>
              ) : (
                <p>Cantidad ingresada: {lastProcessed.quantity} unidades</p>
              )}
            </div>
          </div>
        )}

        {processing && !selectedProduct && (
          <div className="stock-entry-step">
            <Loading size="sm" text="Procesando entrada..." />
          </div>
        )}
      </div>
    </div>
  )
}
