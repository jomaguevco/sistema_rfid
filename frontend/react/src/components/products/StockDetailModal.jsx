import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useRFID } from '../../hooks/useRFID'
import api from '../../services/api'
import Modal from '../common/Modal'
import Table from '../common/Table'
import Button from '../common/Button'
import Input from '../common/Input'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import { formatConcentration, formatRfidCode, normalizeRfidCode } from '../../utils/formatting'
import { HiCube, HiExclamationCircle, HiCheckCircle, HiClock, HiWifi, HiStop, HiTrash } from 'react-icons/hi'
import './ProductDetail.css'

export default function StockDetailModal({ rfidCode, isOpen, onClose }) {
  const { hasRole } = useAuth()
  const queryClient = useQueryClient()
  const [searchRfid, setSearchRfid] = useState('')
  const [searchByRfid, setSearchByRfid] = useState(false)
  const canViewDetails = hasRole('admin') || hasRole('farmaceutico')
  const isAdmin = hasRole('admin') // Solo para acciones de eliminación
  
  // Si no es admin ni farmaceutico, no mostrar el modal
  if (!canViewDetails) {
    return null
  }

  // Primero obtener lotes por IDP para obtener el product_id
  const { data: batchesByRfid, isLoading: loadingByRfid } = useQuery({
    queryKey: ['batches', 'rfid', rfidCode],
    queryFn: async () => {
      const response = await api.get(`/batches/rfid/${rfidCode}`)
      return response.data.data || []
    },
    enabled: isOpen && !!rfidCode
  })

  // Obtener product_id del primer lote
  const productId = batchesByRfid && batchesByRfid.length > 0 ? batchesByRfid[0].product_id : null
  const productName = batchesByRfid && batchesByRfid.length > 0 ? batchesByRfid[0].product_name : null

  // Obtener TODOS los lotes del producto (no solo los que tienen el mismo IDP)
  const { data: batches, isLoading, error, refetch } = useQuery({
    queryKey: ['batches', 'product', productId],
    queryFn: async () => {
      if (!productId) return []
      const response = await api.get(`/batches/product/${productId}`)
      return response.data.data || []
    },
    enabled: isOpen && !!productId
  })

  // Hook RFID para búsqueda por IDP
  const { lastRFID, listening, startListening, stopListening } = useRFID({
    onDetect: (rfidUid) => {
      if (searchByRfid) {
        // Normalizar el RFID a IDP y filtrar
        const normalizedRfid = normalizeRfidCode(rfidUid) || rfidUid
        setSearchRfid(normalizedRfid)
        setSearchByRfid(false)
        stopListening()
      }
    }
  })

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('¿Estás seguro de eliminar este lote? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      await api.delete(`/batches/${batchId}`)
      queryClient.invalidateQueries(['batches', 'product', productId])
      queryClient.invalidateQueries(['batches', 'rfid', rfidCode])
      queryClient.invalidateQueries(['stock'])
      refetch()
    } catch (error) {
      console.error('Error al eliminar lote:', error)
      alert(error.response?.data?.error || 'Error al eliminar el lote')
    }
  }

  const handleClose = () => {
    setSearchRfid('')
    setSearchByRfid(false)
    if (listening) {
      stopListening()
    }
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

  // Agrupar batches por lote (product_id + lot_number + expiry_date)
  const groupedBatches = batches ? batches.reduce((acc, batch) => {
    const lotKey = `${batch.product_id}-${batch.lot_number}-${batch.expiry_date}`
    
    if (!acc[lotKey]) {
      // Obtener todos los RFIDs del lote
      const allRfids = batch.rfid_tags && batch.rfid_tags.length > 0 
        ? batch.rfid_tags 
        : (batch.rfid_uid ? [batch.rfid_uid] : [])
      
      acc[lotKey] = {
        ...batch,
        rfid_tags: allRfids,
        total_quantity: batch.quantity, // La cantidad ya es la suma del lote
        lot_key: lotKey
      }
    } else {
      // Si el lote ya existe, asegurar que todos los RFIDs estén incluidos
      const existingRfids = acc[lotKey].rfid_tags || []
      const newRfids = batch.rfid_tags && batch.rfid_tags.length > 0 
        ? batch.rfid_tags 
        : (batch.rfid_uid ? [batch.rfid_uid] : [])
      
      // Combinar RFIDs únicos
      const allUniqueRfids = [...new Set([...existingRfids, ...newRfids])]
      acc[lotKey].rfid_tags = allUniqueRfids
    }
    
    return acc
  }, {}) : {}

  // Expandir cada lote en múltiples filas (una por cada RFID físico)
  const expandedRows = Object.values(groupedBatches).flatMap((lote, lotIndex) => {
    const rfidTags = lote.rfid_tags && lote.rfid_tags.length > 0 
      ? lote.rfid_tags 
      : (lote.rfid_uid ? [lote.rfid_uid] : [''])
    
    return rfidTags.map((rfid, rfidIndex) => ({
      ...lote,
      rfid_physical: rfid,
      is_first_in_group: rfidIndex === 0,
      is_last_in_group: rfidIndex === rfidTags.length - 1,
      lot_index: lotIndex,
      rfid_index: rfidIndex
    }))
  })

  // Filtrar filas por RFID o IDP si hay búsqueda
  const filteredRows = expandedRows.filter(row => {
    if (!searchRfid.trim()) return true
    const searchTerm = searchRfid.trim().toUpperCase()
    
    // Buscar en el RFID físico de esta fila
    const matchesRfid = row.rfid_physical && (
      normalizeRfidCode(row.rfid_physical)?.includes(searchTerm) ||
      row.rfid_physical.toUpperCase().includes(searchTerm)
    )
    
    // Buscar por IDP (normalizado del código principal)
    const idpCode = normalizeRfidCode(rfidCode) || rfidCode.toUpperCase()
    
    // Buscar en RFID físico, IDP, o número de lote
    return matchesRfid || 
           idpCode.includes(searchTerm) ||
           (row.lot_number && row.lot_number.toUpperCase().includes(searchTerm))
  })

  const columns = [
    {
      key: 'rfid_code',
      header: 'Código IDP',
      render: () => formatRfidCode(rfidCode)
    },
    {
      key: 'rfid_physical',
      header: 'RFID Físico',
      className: 'col-rfid-physical',
      render: (value, row) => {
        // Mostrar el RFID físico de esta fila específica
        return row.rfid_physical ? formatRfidCode(row.rfid_physical) : '-'
      }
    },
    {
      key: 'product_name',
      field: 'product_name',
      header: 'Nombre del Medicamento',
      className: 'col-product-name',
      render: (value, row) => {
        // Mostrar el nombre solo en la primera fila del grupo
        if (row.is_first_in_group) {
          return value || '-'
        }
        return <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
      }
    },
    {
      key: 'lot_number',
      field: 'lot_number',
      header: 'Número de Lote',
      className: 'col-lot-number',
      render: (value, row) => {
        // Mostrar el número de lote solo en la primera fila del grupo
        if (row.is_first_in_group) {
          return value || '-'
        }
        return <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
      }
    },
    {
      key: 'expiry_date',
      field: 'expiry_date',
      header: 'Fecha de Vencimiento',
      render: (value, row) => {
        // Mostrar la fecha solo en la primera fila del grupo
        if (row.is_first_in_group) {
          return formatDate(value)
        }
        return <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
      },
      className: 'col-expiry-date'
    },
    {
      key: 'quantity',
      field: 'total_quantity',
      header: 'Cantidad (Lote)',
      render: (value, row) => {
        // Mostrar la cantidad total del lote (solo en la primera fila del grupo)
        if (row.is_first_in_group) {
          return (
            <Badge variant={value > 0 ? 'success' : 'error'} size="sm">
              {value || 0}
            </Badge>
          )
        }
        // En las demás filas, mostrar vacío o un indicador visual
        return <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
      },
      className: 'col-quantity'
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (_, row) => {
        // Mostrar el estado solo en la primera fila del grupo
        if (row.is_first_in_group) {
          return getEstadoBadge(row)
        }
        return <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
      },
      className: 'col-estado'
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'col-actions',
      render: (_, row) => {
        // Mostrar el botón de eliminar solo en la primera fila del grupo
        if (!row.is_first_in_group) {
          return <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
        }
        if (!isAdmin) return '-'
        return (
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeleteBatch(row.id)}
            title="Eliminar lote (solo administradores)"
          >
            <HiTrash />
            Eliminar
          </Button>
        )
      }
    }
  ]

  // Calcular estadísticas basadas en lotes agrupados (no en batches individuales)
  const uniqueLotes = Object.values(groupedBatches)
  
  // IMPORTANTE: Sumar TODAS las cantidades de TODOS los lotes del producto
  // No solo los lotes únicos agrupados, sino todos los batches individuales
  // Esto asegura que el total coincida con el cálculo del backend
  const totalStock = batches ? batches.reduce((sum, batch) => sum + (parseInt(batch.quantity) || 0), 0) : 0
  
  const validBatches = uniqueLotes.filter(l => !l.is_expired && l.total_quantity > 0)
  const expiredBatches = uniqueLotes.filter(l => l.is_expired && l.total_quantity > 0)
  const expiringSoonBatches = uniqueLotes.filter(l => 
    !l.is_expired && 
    l.total_quantity > 0 && 
    l.days_to_expiry <= 30
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Detalle de Stock - RFID: ${formatRfidCode(rfidCode)}`}
      size="xl"
    >
      {(isLoading || loadingByRfid) ? (
        <Loading text="Cargando lotes..." />
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
            Error al cargar los lotes: {error.response?.data?.error || error.message}
          </p>
        </div>
      ) : batches && batches.length > 0 ? (
        <div className="stock-detail-modal">
          {/* Búsqueda prominente en la parte superior */}
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            background: 'var(--color-background-secondary)', 
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Buscar por RFID Físico o IDP"
                  placeholder="Ingresa el código RFID físico o IDP para filtrar..."
                  value={searchRfid}
                  onChange={(e) => setSearchRfid(e.target.value)}
                />
              </div>
              <Button
                variant={searchByRfid ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  if (searchByRfid) {
                    setSearchByRfid(false)
                    stopListening()
                  } else {
                    setSearchByRfid(true)
                    startListening()
                  }
                }}
                title="Buscar por IDP mediante escaneo RFID"
              >
                {searchByRfid ? <HiStop /> : <HiWifi />}
                {searchByRfid ? 'Detener' : 'Buscar por IDP'}
              </Button>
            </div>
            {searchByRfid && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--color-primary-light)', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', animation: 'pulse 2s infinite' }}></span>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-primary)' }}>
                  Escaneo activo - Acerca el tag RFID
                </span>
                {lastRFID && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                    Detectado: {formatRfidCode(lastRFID.uid)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Resúmenes en cards mejoradas */}
          <div className="stock-summary" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div className="summary-item" style={{
              padding: '1rem',
              background: 'var(--color-primary-light)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-primary)'
            }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Total de Lotes</label>
              <Badge variant="info" size="lg" style={{ fontSize: '1.25rem' }}>{uniqueLotes.length}</Badge>
            </div>
            <div className="summary-item" style={{
              padding: '1rem',
              background: totalStock > 0 ? 'var(--color-success-light)' : 'var(--color-error-light)',
              borderRadius: '0.5rem',
              border: `1px solid ${totalStock > 0 ? 'var(--color-success)' : 'var(--color-error)'}`
            }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Stock Total</label>
              <Badge variant={totalStock > 0 ? 'success' : 'error'} size="lg" style={{ fontSize: '1.25rem' }}>{totalStock}</Badge>
            </div>
            <div className="summary-item" style={{
              padding: '1rem',
              background: 'var(--color-success-light)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-success)'
            }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Lotes Válidos</label>
              <Badge variant="success" size="lg" style={{ fontSize: '1.25rem' }}>{validBatches.length}</Badge>
            </div>
            {expiredBatches.length > 0 && (
              <div className="summary-item" style={{
                padding: '1rem',
                background: 'var(--color-error-light)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-error)'
              }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Lotes Vencidos</label>
                <Badge variant="error" size="lg" style={{ fontSize: '1.25rem' }}>{expiredBatches.length}</Badge>
              </div>
            )}
            {expiringSoonBatches.length > 0 && (
              <div className="summary-item" style={{
                padding: '1rem',
                background: 'var(--color-warning-light)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-warning)'
              }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'block' }}>Próximos a vencer</label>
                <Badge variant="warning" size="lg" style={{ fontSize: '1.25rem' }}>{expiringSoonBatches.length}</Badge>
              </div>
            )}
          </div>

          <div className="batches-table-container">
            <Table
              columns={columns}
              data={filteredRows}
              emptyMessage={searchRfid.trim() ? `No se encontraron lotes con el RFID: ${searchRfid}` : "No se encontraron lotes con este IDP"}
              rowClassName={(row, index) => {
                // Aplicar estilos de agrupación visual
                let className = ''
                if (row.is_first_in_group) {
                  className += ' batch-group-first '
                }
                if (row.is_last_in_group) {
                  className += ' batch-group-last '
                }
                if (!row.is_first_in_group && !row.is_last_in_group) {
                  className += ' batch-group-middle '
                }
                // Alternar colores de fondo para grupos de lotes
                if (row.lot_index % 2 === 0) {
                  className += ' batch-group-even '
                } else {
                  className += ' batch-group-odd '
                }
                return className.trim()
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>No se encontraron lotes con el código IDP: {formatRfidCode(rfidCode)}</p>
        </div>
      )}
    </Modal>
  )
}

