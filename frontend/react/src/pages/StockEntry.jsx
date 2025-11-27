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
import { HiArrowDown, HiWifi, HiStop, HiCheckCircle, HiPlus, HiTrash, HiX, HiSearch, HiRefresh } from 'react-icons/hi'
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
    boxes: 1  // Nuevo campo para cantidad de cajas
  })
  const [entryMode, setEntryMode] = useState('boxes') // 'boxes' o 'units' - por defecto cajas
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
        
        // SIEMPRE detener el escaneo después de detectar un RFID
        // El usuario debe presionar "Iniciar Escaneo" nuevamente para continuar
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
    // Inicializar con 1 caja por defecto
    const unitsPerBox = product?.units_per_package || 1
    setBatchData({
      lot_number: '',
      expiry_date: '',
      quantity: unitsPerBox,  // Por defecto 1 caja = units_per_package unidades
      boxes: 1
    })
    // Si el producto tiene más de 1 unidad por caja, usar modo cajas por defecto
    setEntryMode(unitsPerBox > 1 ? 'boxes' : 'units')
    setErrors({})
    setPendingEntries([])
  }

  // Calcular cantidad total basado en el modo de entrada
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

  // Constantes de validación (sincronizadas con backend)
  const VALIDATION_RULES = {
    MIN_QUANTITY: 1,
    MAX_QUANTITY_PER_OPERATION: 10000
  }

  const handleAddBatch = async () => {
    // Validar campos
    const newErrors = {}
    if (!batchData.lot_number.trim()) {
      newErrors.lot_number = 'El número de lote es requerido'
    }
    if (!batchData.expiry_date) {
      newErrors.expiry_date = 'La fecha de vencimiento es requerida'
    } else {
      // VALIDACIÓN: La fecha de vencimiento no puede ser pasada
      const expiryDate = new Date(batchData.expiry_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (expiryDate < today) {
        newErrors.expiry_date = 'La fecha de vencimiento no puede ser anterior a hoy'
      }
    }
    
    // Usar cantidad total calculada (considera modo cajas vs unidades)
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
      // Validar RFID duplicado en la lista pendiente
      const normalizedScannedRfid = normalizeRfidCode(scannedRfid) || scannedRfid
      const isDuplicateInList = pendingEntries.some(e => {
        const normalizedEntryRfid = normalizeRfidCode(e.rfid) || e.rfid
        return normalizedEntryRfid === normalizedScannedRfid
      })
      
      if (isDuplicateInList) {
        setErrors({ rfid: 'Este IDP ya está en la lista pendiente' })
        return
      }
      
      // Validar RFID duplicado contra la base de datos ANTES de agregar
      // Esta validación es asíncrona, así que necesitamos hacerla antes de agregar
      setProcessing(true)
      setErrors({})
      
      // Validar contra la base de datos (solo bloqueamos si es producto diferente)
      const validateRfidInDatabase = async () => {
        try {
          const normalizedRfid = normalizeRfidCode(scannedRfid) || scannedRfid
          const existingBatchResponse = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
          const existingBatches = existingBatchResponse.data.data || []
          
          if (existingBatches.length > 0) {
            const activeBatch = existingBatches.find(b => b.quantity > 0)
            
            if (activeBatch) {
              const isDifferentProduct = activeBatch.product_id !== selectedProduct.id
              
              // Solo bloqueamos si es un producto DIFERENTE
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
              // Si es el mismo producto, permitir (el backend sumará el stock)
            }
          }
          
          // Si pasa todas las validaciones, agregar a lista pendiente
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
          
          // Mantener datos del formulario, limpiar solo RFID y errores
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
      // Procesar inmediatamente
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
      
      // El backend ahora maneja la lógica de sumar stock si es el mismo producto
      // Solo verificamos si es un producto diferente para mostrar advertencia más clara
      try {
        const existingBatchResponse = await api.get(`/batches?rfid_uid=${normalizedRfid}`)
        const existingBatches = existingBatchResponse.data.data || []
        
        if (existingBatches.length > 0) {
          const activeBatch = existingBatches.find(b => b.quantity > 0)
          
          if (activeBatch) {
            // Solo bloqueamos si es un producto DIFERENTE
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
            // Si es el mismo producto, dejamos que el backend sume el stock
          }
        }
      } catch (checkError) {
        // Si hay error al verificar, continuar
        if (checkError.response?.status !== 400) {
          console.warn('Error al verificar RFID existente:', checkError)
        }
      }
      
      const response = await api.post('/batches', {
        ...batchDataToProcess,
        rfid_uid: normalizedRfid
      })

      // Verificar si fue una suma de stock o creación de lote nuevo
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

      // Detener escaneo si está activo (siempre)
      if (listening) {
        setListening(false)
        stopRFID()
      }
      
      // Limpiar formulario
      setShowBatchForm(false)
      const unitsPerBox = selectedProduct?.units_per_package || 1
      setBatchData({
        lot_number: '',
        expiry_date: '',
        quantity: unitsPerBox,
        boxes: 1
      })
      setScannedRfid(null)
      
      // Invalidar queries
      queryClient.invalidateQueries(['batches'])
      queryClient.invalidateQueries(['stock'])
      queryClient.invalidateQueries(['products'])

      // Limpiar después de 4 segundos (un poco más para leer el mensaje)
      setTimeout(() => {
        setLastProcessed(null)
        if (!multipleMode) {
          setSelectedProduct(null)
        }
      }, 4000)
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error al crear el lote'
      const batchInfo = err.response?.data?.batch_info || null
      
      // Si es error de IDP duplicado (producto diferente)
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
        // Asegurar que quantity sea un número válido
        const quantityValue = parseInt(entry.quantity) || 1
        await processBatch({
          product_id: entry.product.id,
          rfid_uid: entry.rfid,
          lot_number: entry.lot_number,
          expiry_date: entry.expiry_date,
          quantity: quantityValue
        })
      }

      // Detener escaneo si está activo
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
      <div className="page-header">
        <div>
          <h1>Entrada de Stock</h1>
          <p className="page-subtitle">Seleccionar producto y escanear IDP (código que agrupa los RFID físicos) para registrar ingreso</p>
        </div>
      </div>

      <Card shadow="md" className="entry-card">
        <div className="entry-content">
          {/* Selección de Producto */}
          <div className="product-selection-section">
            <h3><span className="step-number">1</span> Seleccionar Producto</h3>
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
                            <span className="product-detail"> - {product.active_ingredient}</span>
                          )}
                          {product.presentation && (
                            <span className="product-detail"> - {product.presentation}</span>
                          )}
                          {product.units_per_package && product.units_per_package > 1 && (
                            <span className="product-detail"> ({product.units_per_package} por caja)</span>
                          )}
                          {product.units_per_package === 1 && (
                            <span className="product-detail"> (unidad individual)</span>
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
                    // Detener escaneo si está activo
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
                  <HiX />
                  Cambiar Producto
                </Button>
              </div>
            )}
          </div>

          {/* Escaneo IDP */}
          {selectedProduct && (
            <div className="rfid-scan-section">
              <h3><span className="step-number">2</span> Escanear IDP</h3>
              <div className="scan-controls">
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
                  <div className="rfid-status">
                    <span className="rfid-indicator pulse"></span>
                    <span>
                      {multipleMode 
                        ? 'Escaneo automático activo - Acerca el siguiente IDP' 
                        : 'Esperando IDP... Acerca el tag'}
                    </span>
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
                
                {errors.rfid && (
                  <div className="error-message" role="alert" style={{ marginTop: '0.5rem' }}>
                    {errors.rfid}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulario de Lote */}
          {selectedProduct && scannedRfid && (
            <div className="batch-form-section">
              <h3><span className="step-number">3</span> Ingresar Datos del Lote</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={multipleMode}
                    onChange={(e) => {
                      setMultipleMode(e.target.checked)
                      if (!e.target.checked) {
                        setPendingEntries([])
                        // Detener escaneo si está activo
                        if (listening) {
                          setListening(false)
                          stopRFID()
                        }
                      }
                    }}
                  />
                  <span>Modo múltiple (agregar varios medicamentos con diferentes IDP del mismo producto)</span>
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
                
                {/* Selector de modo de entrada para productos con múltiples unidades por caja */}
                {selectedProduct?.units_per_package > 1 && (
                  <div className="entry-mode-selector">
                    <label>Modo de Ingreso:</label>
                    <div className="entry-mode-buttons">
                      <button
                        type="button"
                        className={`entry-mode-btn ${entryMode === 'boxes' ? 'active' : ''}`}
                        onClick={() => {
                          setEntryMode('boxes')
                          const newQuantity = (batchData.boxes || 1) * selectedProduct.units_per_package
                          setBatchData({ ...batchData, quantity: newQuantity })
                        }}
                      >
                        <span className="mode-icon">📦</span> Por Cajas
                      </button>
                      <button
                        type="button"
                        className={`entry-mode-btn ${entryMode === 'units' ? 'active' : ''}`}
                        onClick={() => setEntryMode('units')}
                      >
                        <span className="mode-icon">💊</span> Por Unidades
                      </button>
                    </div>
                  </div>
                )}

                {/* Entrada por CAJAS */}
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
                    <div className="stock-calculator">
                      <div className="calc-header">
                        <span>🧮</span> Cálculo Automático:
                      </div>
                      <div className="calc-formula">
                        {batchData.boxes || 1} caja{(batchData.boxes || 1) > 1 ? 's' : ''} × {selectedProduct.units_per_package} unidades
                      </div>
                      <div className="calc-result">
                        = <span className="total-number">{calculateTotalQuantity()}</span> unidades totales
                      </div>
                    </div>
                  </>
                )}

                {/* Entrada por UNIDADES (o para productos sin múltiples unidades) */}
                {(selectedProduct?.units_per_package <= 1 || entryMode === 'units') && (
                  <>
                    <Input
                      label={`Cantidad (unidades individuales)`}
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
                    {selectedProduct?.units_per_package > 1 && batchData.quantity > 0 && (
                      <div className="equivalence-info">
                        <span className="eq-icon">📦</span>
                        Equivale a: <strong>{Math.ceil(batchData.quantity / selectedProduct.units_per_package)}</strong> caja(s) 
                        de {selectedProduct.units_per_package} unidades cada una
                      </div>
                    )}
                  </>
                )}
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
                    // Detener escaneo si está activo
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

          {/* Mensaje de éxito */}
          {lastProcessed && (
            <div className={lastProcessed.action === 'stock_added' ? 'stock-added-message' : 'success-message'}>
              {lastProcessed.action === 'stock_added' ? <HiRefresh size={32} /> : <HiCheckCircle size={32} />}
              <div>
                <strong>
                  {lastProcessed.action === 'stock_added' 
                    ? '📦 Stock Agregado al Lote Existente' 
                    : '✅ Nuevo Lote Creado'}
                </strong>
                <p>Medicamento: {lastProcessed.product}</p>
                
                {lastProcessed.action === 'stock_added' ? (
                  <>
                    <div className="added-summary">
                      <p style={{ margin: 0 }}>
                        <strong>+{lastProcessed.added_quantity}</strong> unidades agregadas
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                        Stock anterior: {lastProcessed.previous_quantity} → 
                        <strong> Nuevo stock: {lastProcessed.new_quantity}</strong> unidades
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p>Cantidad ingresada: {lastProcessed.quantity} unidades</p>
                    {selectedProduct?.units_per_package > 1 && (
                      <p style={{ fontSize: '0.875rem', opacity: '0.9', marginTop: '0.25rem' }}>
                        ({Math.ceil(lastProcessed.quantity / selectedProduct.units_per_package)} caja{Math.ceil(lastProcessed.quantity / selectedProduct.units_per_package) > 1 ? 's' : ''})
                      </p>
                    )}
                  </>
                )}
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
