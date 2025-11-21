import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import Modal from '../common/Modal'
import Badge from '../common/Badge'
import Loading from '../common/Loading'
import Button from '../common/Button'
import './PredictionDetailModal.css'

export default function PredictionDetailModal({ productId, isOpen, onClose }) {
  const { data: predictions, isLoading } = useQuery({
    queryKey: ['product-predictions', productId],
    queryFn: async () => {
      const response = await api.get(`/predictions/product/${productId}`)
      return response.data.data || []
    },
    enabled: isOpen && !!productId
  })

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const response = await api.get(`/products/${productId}`)
      return response.data.data
    },
    enabled: isOpen && !!productId
  })

  const getPeriodLabel = (period) => {
    const labels = {
      month: 'Próximo Mes',
      quarter: 'Próximo Trimestre',
      year: 'Próximo Año'
    }
    return labels[period] || period
  }

  const getConfidenceVariant = (level) => {
    if (level >= 80) return 'success'
    if (level >= 50) return 'warning'
    return 'error'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Predicciones: ${product?.name || 'Medicamento'}`}
      size="lg"
    >
      {isLoading ? (
        <Loading text="Cargando detalles..." />
      ) : predictions && predictions.length > 0 ? (
        <div className="prediction-detail">
          {product && (
            <div className="product-info">
              <h4>Información del Medicamento</h4>
              <div className="info-grid">
                <div>
                  <label>Stock Actual:</label>
                  <Badge variant={product.total_stock > 0 ? 'success' : 'error'}>
                    {product.total_stock || 0} unidades
                  </Badge>
                </div>
                <div>
                  <label>Stock Mínimo:</label>
                  <span>{product.min_stock || 0} unidades</span>
                </div>
              </div>
            </div>
          )}

          <div className="predictions-list">
            <h4>Predicciones por Período</h4>
            {predictions.map((prediction) => {
              const deficit = (prediction.predicted_quantity || 0) - (product?.total_stock || 0)
              return (
                <div key={prediction.id} className="prediction-item">
                  <div className="prediction-period">
                    <strong>{getPeriodLabel(prediction.prediction_period)}</strong>
                    <Badge variant={getConfidenceVariant(prediction.confidence_level)}>
                      {Math.round(prediction.confidence_level || 0)}% confianza
                    </Badge>
                  </div>
                  <div className="prediction-details">
                    <div className="detail-row">
                      <span>Predicción:</span>
                      <strong>{Math.round(prediction.predicted_quantity || 0)} unidades</strong>
                    </div>
                    <div className="detail-row">
                      <span>Stock Actual:</span>
                      <span>{product?.total_stock || 0} unidades</span>
                    </div>
                    {deficit > 0 && (
                      <div className="detail-row deficit">
                        <span>Déficit:</span>
                        <Badge variant="error">{Math.round(deficit)} unidades faltantes</Badge>
                      </div>
                    )}
                    {deficit <= 0 && (
                      <div className="detail-row sufficient">
                        <span>Estado:</span>
                        <Badge variant="success">Stock suficiente</Badge>
                      </div>
                    )}
                    <div className="detail-row">
                      <span>Algoritmo:</span>
                      <span className="algorithm">{prediction.algorithm_used || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Fecha de cálculo:</span>
                      <span>{new Date(prediction.calculation_date).toLocaleDateString('es-ES')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>No hay predicciones disponibles para este medicamento.</p>
        </div>
      )}
    </Modal>
  )
}

