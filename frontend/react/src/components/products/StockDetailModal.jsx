import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Modal from '../common/Modal'
import Table from '../common/Table'
import Button from '../common/Button'
import Input from '../common/Input'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import { formatConcentration, formatRfidCode, normalizeRfidCode } from '../../utils/formatting'
import { HiCube, HiExclamationCircle, HiCheckCircle, HiClock, HiPlus } from 'react-icons/hi'
import './ProductDetail.css'

export default function StockDetailModal({ rfidCode, isOpen, onClose }) {
  const { canPerformAction } = useAuth()
  const queryClient = useQueryClient()
  const [showAddBatch, setShowAddBatch] = useState(false)
  const [newBatch, setNewBatch] = useState({
    lot_number: '',
    expiry_date: '',
    quantity: 1
  })
  const [errors, setErrors] = useState({})

  const canCreateBatch = canPerformAction('batches', 'create')

  const { data: batches, isLoading, error, refetch } = useQuery({
    queryKey: ['batches', 'rfid', rfidCode],
    queryFn: async () => {
      const response = await api.get(`/batches/rfid/${rfidCode}`)
      return response.data.data || []
    },
    enabled: isOpen && !!rfidCode
  })

  // Obtener product_id del primer lote (todos los lotes con el mismo RFID deberían ser del mismo producto)
  const productId = batches && batches.length > 0 ? batches[0].product_id : null
  const productName = batches && batches.length > 0 ? batches[0].product_name : null

  const addBatchMutation = useMutation({
    mutationFn: async (batchData) => {
      const response = await api.post('/batches', batchData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['batches', 'rfid', rfidCode])
      queryClient.invalidateQueries(['stock'])
      setShowAddBatch(false)
      setNewBatch({
        lot_number: '',
        expiry_date: '',
        quantity: 1
      })
      setErrors({})
      refetch()
    },
    onError: (error) => {
      setErrors({
        submit: error.response?.data?.error || 'Error al crear el lote'
      })
    }
  })

  const handleAddBatch = () => {
    if (!productId) {
      setErrors({ submit: 'No se pudo obtener el producto. Por favor, cierra y vuelve a abrir el modal.' })
      return
    }

    // Validar campos
    const newErrors = {}
    if (!newBatch.lot_number.trim()) {
      newErrors.lot_number = 'El número de lote es requerido'
    }
    if (!newBatch.expiry_date) {
      newErrors.expiry_date = 'La fecha de vencimiento es requerida'
    }
    if (!newBatch.quantity || newBatch.quantity < 1) {
      newErrors.quantity = 'La cantidad debe ser mayor a 0'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Normalizar RFID antes de enviar
    const normalizedRfid = normalizeRfidCode(rfidCode) || rfidCode

    // Crear el lote
    addBatchMutation.mutate({
      product_id: productId,
      lot_number: newBatch.lot_number.trim(),
      expiry_date: newBatch.expiry_date,
      quantity: parseInt(newBatch.quantity),
      rfid_uid: normalizedRfid
    })
  }

  const handleClose = () => {
    setShowAddBatch(false)
    setNewBatch({
      lot_number: '',
      expiry_date: '',
      quantity: 1
    })
    setErrors({})
    onClose()
  }

  const getEstadoBadge = (batch) => {
    if (batch.is_expired || batch.estado === 'vencido') {
      return <Badge variant="error" size="sm"><HiExclamationCircle /> Vencido</Badge>
    }
    if (batch.days_to_expiry <= 30 || batch.estado === 'proximo_vencer') {
      return <Badge variant="warning" size="sm"><HiClock /> Próximo a vencer</Badge>
    }
    return <Badge variant="success" size="sm"><HiCheckCircle /> Válido</Badge>
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    })
  }

  const columns = [
    {
      key: 'rfid_code',
      header: 'Código RFID',
      render: () => formatRfidCode(rfidCode)
    },
    {
      key: 'product_name',
      field: 'product_name',
      header: 'Nombre del Medicamento',
      className: 'col-product-name'
    },
    {
      key: 'lot_number',
      field: 'lot_number',
      header: 'Número de Lote',
      className: 'col-lot-number'
    },
    {
      key: 'expiry_date',
      field: 'expiry_date',
      header: 'Fecha de Vencimiento',
      render: (value) => formatDate(value),
      className: 'col-expiry-date'
    },
    {
      key: 'quantity',
      field: 'quantity',
      header: 'Cantidad',
      render: (value) => (
        <Badge variant={value > 0 ? 'success' : 'error'} size="sm">
          {value || 0}
        </Badge>
      ),
      className: 'col-quantity'
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (_, row) => getEstadoBadge(row),
      className: 'col-estado'
    }
  ]

  const totalStock = batches?.reduce((sum, batch) => sum + (batch.quantity || 0), 0) || 0
  const validBatches = batches?.filter(b => !b.is_expired && b.quantity > 0) || []
  const expiredBatches = batches?.filter(b => b.is_expired && b.quantity > 0) || []
  const expiringSoonBatches = batches?.filter(b => 
    !b.is_expired && 
    b.quantity > 0 && 
    b.days_to_expiry <= 30
  ) || []

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Detalle de Stock - RFID: ${formatRfidCode(rfidCode)}`}
      size="xl"
    >
      {isLoading ? (
        <Loading text="Cargando lotes..." />
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
            Error al cargar los lotes: {error.response?.data?.error || error.message}
          </p>
        </div>
      ) : batches && batches.length > 0 ? (
        <div className="stock-detail-modal">
          <div className="stock-summary">
            <div className="summary-item">
              <label>Total de Lotes:</label>
              <Badge variant="info">{batches.length}</Badge>
            </div>
            <div className="summary-item">
              <label>Stock Total:</label>
              <Badge variant={totalStock > 0 ? 'success' : 'error'}>{totalStock}</Badge>
            </div>
            <div className="summary-item">
              <label>Lotes Válidos:</label>
              <Badge variant="success">{validBatches.length}</Badge>
            </div>
            {expiredBatches.length > 0 && (
              <div className="summary-item">
                <label>Lotes Vencidos:</label>
                <Badge variant="error">{expiredBatches.length}</Badge>
              </div>
            )}
            {expiringSoonBatches.length > 0 && (
              <div className="summary-item">
                <label>Próximos a vencer:</label>
                <Badge variant="warning">{expiringSoonBatches.length}</Badge>
              </div>
            )}
          </div>

          {canCreateBatch && (
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddBatch(true)}
              >
                <HiPlus />
                Agregar Lote
              </Button>
            </div>
          )}

          {showAddBatch && (
            <div style={{ 
              padding: '1rem', 
              marginBottom: '1rem', 
              border: '1px solid var(--color-border)', 
              borderRadius: '0.5rem',
              background: 'var(--color-background-secondary)'
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Nuevo Lote</h4>
              {productName && (
                <p style={{ marginBottom: '1rem', color: 'var(--color-text-secondary)' }}>
                  Producto: <strong>{productName}</strong> - RFID: <strong>{formatRfidCode(rfidCode)}</strong>
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <Input
                  label="Número de Lote"
                  value={newBatch.lot_number}
                  onChange={(e) => {
                    setNewBatch({ ...newBatch, lot_number: e.target.value })
                    setErrors({ ...errors, lot_number: '' })
                  }}
                  error={errors.lot_number}
                  placeholder="Ej: LOT-2025-001"
                />
                <Input
                  label="Fecha de Vencimiento"
                  type="date"
                  value={newBatch.expiry_date}
                  onChange={(e) => {
                    setNewBatch({ ...newBatch, expiry_date: e.target.value })
                    setErrors({ ...errors, expiry_date: '' })
                  }}
                  error={errors.expiry_date}
                />
                <Input
                  label="Cantidad"
                  type="number"
                  min="1"
                  value={newBatch.quantity}
                  onChange={(e) => {
                    setNewBatch({ ...newBatch, quantity: parseInt(e.target.value) || 1 })
                    setErrors({ ...errors, quantity: '' })
                  }}
                  error={errors.quantity}
                />
              </div>
              {errors.submit && (
                <p style={{ color: 'var(--color-error)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  {errors.submit}
                </p>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAddBatch(false)
                    setErrors({})
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddBatch}
                  loading={addBatchMutation.isPending}
                >
                  Guardar Lote
                </Button>
              </div>
            </div>
          )}

          <div className="batches-table-container">
            <Table
              columns={columns}
              data={batches}
              emptyMessage="No se encontraron lotes con este RFID"
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No se encontraron lotes con el código RFID: {formatRfidCode(rfidCode)}</p>
        </div>
      )}
    </Modal>
  )
}

