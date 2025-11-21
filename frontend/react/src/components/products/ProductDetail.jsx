import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import { HiCube, HiInformationCircle } from 'react-icons/hi'
import './ProductDetail.css'

export default function ProductDetail({ productId, isOpen, onClose }) {
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      try {
        const response = await api.get(`/products/${productId}`)
        if (response.data.success && response.data.data) {
          return response.data.data
        }
        throw new Error('Producto no encontrado')
      } catch (err) {
        console.error('Error al obtener producto:', err)
        throw err
      }
    },
    enabled: isOpen && !!productId
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalles del Medicamento"
      size="lg"
    >
      {isLoading ? (
        <Loading text="Cargando detalles..." />
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
            Error al cargar los detalles: {error.response?.data?.error || error.message || 'Error desconocido'}
          </p>
        </div>
      ) : product ? (
        <div className="product-detail">
          <div className="detail-header">
            <div className="product-icon">
              <HiCube />
            </div>
            <div>
              <h3>{product.name}</h3>
              <Badge variant={product.product_type === 'medicamento' ? 'primary' : 'info'}>
                {product.product_type === 'medicamento' ? 'Medicamento' : 'Insumo'}
              </Badge>
            </div>
          </div>

          {product.description && (
            <div className="detail-section">
              <h4>Descripción</h4>
              <p>{product.description}</p>
            </div>
          )}

          {product.product_type === 'medicamento' && (
            <div className="detail-section">
              <h4>Información Médica</h4>
              <div className="detail-grid">
                {product.active_ingredient && (
                  <div>
                    <label>Principio Activo:</label>
                    <span>{product.active_ingredient}</span>
                  </div>
                )}
                {product.concentration && (
                  <div>
                    <label>Concentración:</label>
                    <span>{product.concentration}</span>
                  </div>
                )}
                {product.presentation && (
                  <div>
                    <label>Presentación:</label>
                    <span>{product.presentation}</span>
                  </div>
                )}
                {product.administration_route && (
                  <div>
                    <label>Vía de Administración:</label>
                    <span>{product.administration_route}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h4>Información de Stock</h4>
            <div className="detail-grid">
              <div>
                <label>Stock Total:</label>
                <Badge variant={product.total_stock > 0 ? 'success' : 'error'}>
                  {product.total_stock || 0} unidades
                </Badge>
              </div>
              <div>
                <label>Stock Mínimo:</label>
                <span>{product.min_stock || 0} unidades</span>
              </div>
              <div>
                <label>Unidades por Paquete:</label>
                <span>{product.units_per_package || 1}</span>
              </div>
              <div>
                <label>Requiere Refrigeración:</label>
                <Badge variant={product.requires_refrigeration ? 'warning' : 'default'}>
                  {product.requires_refrigeration ? 'Sí' : 'No'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4>Identificadores</h4>
            <div className="detail-grid">
              {product.barcode && (
                <div>
                  <label>Código de Barras:</label>
                  <Badge variant="info">{product.barcode}</Badge>
                </div>
              )}
              {product.rfid_uid && (
                <div>
                  <label>Tag Principal:</label>
                  <Badge variant="primary">{product.rfid_uid}</Badge>
                </div>
              )}
              {product.category_name && (
                <div>
                  <label>Categoría:</label>
                  <span>{product.category_name}</span>
                </div>
              )}
            </div>
          </div>

          {product.total_stock !== undefined && product.min_stock !== undefined && (
            <div className="detail-section">
              <div className={`stock-alert ${product.total_stock < product.min_stock ? 'alert-low' : 'alert-ok'}`}>
                <HiInformationCircle />
                <div>
                  <strong>
                    {product.total_stock < product.min_stock
                      ? 'Stock Bajo'
                      : 'Stock Adecuado'}
                  </strong>
                  <p>
                    {product.total_stock < product.min_stock
                      ? `El stock actual (${product.total_stock}) está por debajo del mínimo (${product.min_stock})`
                      : `El stock actual (${product.total_stock}) está por encima del mínimo (${product.min_stock})`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p>Error al cargar los detalles del medicamento</p>
      )}
    </Modal>
  )
}

