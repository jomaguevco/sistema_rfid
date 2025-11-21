import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Button from '../common/Button'
import Modal from '../common/Modal'
import Loading from '../common/Loading'
import { HiChartBar } from 'react-icons/hi'
import './GeneratePredictionsButton.css'

export default function GeneratePredictionsButton({ areaId = null }) {
  const { canPerformAction } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(null)
  
  const canGenerate = canPerformAction('predictions', 'create')
  
  if (!canGenerate) return null

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      setGenerating(true)
      setProgress({ current: 0, total: 0, message: 'Obteniendo productos...' })
      
      try {
        const response = await api.post('/predictions/generate-all', { area_id: areaId })
        return response.data
      } finally {
        setGenerating(false)
        setProgress(null)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['predictions'])
      queryClient.invalidateQueries(['predictions-summary'])
      setShowModal(false)
    }
  })

  const handleGenerate = () => {
    generateAllMutation.mutate()
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
      >
        <HiChartBar />
        Generar Todas las Predicciones
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => !generating && setShowModal(false)}
        title="Generar Predicciones"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={generating}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={generating}
              disabled={generating}
            >
              Generar
            </Button>
          </>
        }
      >
        <div className="generate-predictions-content">
          <p>
            Esto generará predicciones para todos los productos{areaId ? ' del área seleccionada' : ''}.
            El proceso puede tardar varios minutos.
          </p>
          {progress && (
            <div className="progress-info">
              <Loading text={progress.message} />
            </div>
          )}
          {generateAllMutation.isError && (
            <div className="error-message">
              Error: {generateAllMutation.error?.response?.data?.error || 'Error al generar predicciones'}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

