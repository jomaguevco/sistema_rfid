import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../services/api'
import Card from '../components/common/Card'
import Input from '../components/common/Input'
import Button from '../components/common/Button'
import Loading from '../components/common/Loading'
import Badge from '../components/common/Badge'
import QRDispenseModal from '../components/prescriptions/QRDispenseModal'
import { HiQrcode, HiCamera, HiStop, HiSearch, HiX } from 'react-icons/hi'
import './QRScanner.css'

export default function QRScanner() {
  const [qrCode, setQrCode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [scanner, setScanner] = useState(null)
  const scannerRef = useRef(null)

  const { data: prescription, isLoading, refetch } = useQuery({
    queryKey: ['prescription-qr', qrCode],
    queryFn: async () => {
      if (!qrCode || qrCode.trim() === '') return null
      
      try {
        const response = await api.get(`/prescriptions/qr/${qrCode.trim()}`)
        if (!response.data.success) {
          throw new Error(response.data.error || 'Receta no encontrada')
        }
        return response.data.data
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Error al buscar receta')
        throw err
      }
    },
    enabled: !!qrCode && qrCode.trim() !== '',
    retry: false
  })

  const [showDispenseModal, setShowDispenseModal] = useState(false)

  useEffect(() => {
    return () => {
      // Limpiar scanner al desmontar
      if (scanner) {
        scanner.stop().catch(() => {})
      }
    }
  }, [scanner])

  const startScanning = async () => {
    try {
      setError('')
      setScanning(true)
      
      const html5QrCode = new Html5Qrcode('qr-reader')
      
      await html5QrCode.start(
        { facingMode: 'environment' }, // Usar cámara trasera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          // QR detectado
          handleQRDetected(decodedText)
        },
        (errorMessage) => {
          // Ignorar errores de escaneo continuo
        }
      )
      
      setScanner(html5QrCode)
    } catch (err) {
      console.error('Error al iniciar escáner:', err)
      setError('No se pudo acceder a la cámara. Verifica los permisos o usa el input manual.')
      setScanning(false)
    }
  }

  const stopScanning = async () => {
    try {
      if (scanner) {
        await scanner.stop()
        await scanner.clear()
        setScanner(null)
      }
      setScanning(false)
    } catch (err) {
      console.error('Error al detener escáner:', err)
    }
  }

  const handleQRDetected = (code) => {
    setQrCode(code)
    stopScanning()
  }

  const handleManualSearch = () => {
    if (!manualCode || manualCode.trim() === '') {
      setError('Por favor ingresa un código de receta')
      return
    }
    setQrCode(manualCode.trim())
    setError('')
  }

  const handleDispense = () => {
    if (prescription) {
      setShowDispenseModal(true)
    }
  }

  const handleDispenseSuccess = () => {
    setShowDispenseModal(false)
    setQrCode('')
    setManualCode('')
    setError('')
    refetch()
  }

  return (
    <div className="qr-scanner-page">
      <Card>
        <div className="qr-scanner-header">
          <h1>
            <HiQrcode className="icon" />
            Escáner de Recetas QR
          </h1>
          <p>Escanea el código QR de una receta médica para realizar el despacho</p>
        </div>

        <div className="qr-scanner-content">
          {/* Sección de escáner de cámara */}
          <div className="scanner-section">
            <div className="scanner-controls">
              {!scanning ? (
                <Button
                  variant="primary"
                  onClick={startScanning}
                  icon={<HiCamera />}
                >
                  Activar Cámara
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={stopScanning}
                  icon={<HiStop />}
                >
                  Detener Escáner
                </Button>
              )}
            </div>

            {scanning && (
              <div className="scanner-preview">
                <div id="qr-reader" ref={scannerRef}></div>
                <p className="scanner-hint">Apunta la cámara al código QR de la receta</p>
              </div>
            )}
          </div>

          {/* Separador */}
          <div className="scanner-divider">
            <span>O</span>
          </div>

          {/* Sección de input manual */}
          <div className="manual-input-section">
            <h3>Ingresar Código Manualmente</h3>
            <div className="manual-input-group">
              <Input
                type="text"
                placeholder="Ingresa el código de la receta (ej: REC-2024-1234)"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value)
                  setError('')
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualSearch()
                  }
                }}
              />
              <Button
                variant="primary"
                onClick={handleManualSearch}
                icon={<HiSearch />}
              >
                Buscar
              </Button>
            </div>
          </div>

          {/* Mensajes de error */}
          {error && (
            <div className="error-message">
              <HiX className="icon" />
              {error}
            </div>
          )}

          {/* Resultado de búsqueda */}
          {isLoading && qrCode && (
            <div className="loading-container">
              <Loading />
              <p>Buscando receta...</p>
            </div>
          )}

          {prescription && !isLoading && (
            <div className="prescription-result">
              <div className="result-header">
                <h2>Receta Encontrada</h2>
                <Badge variant={prescription.status === 'fulfilled' ? 'success' : prescription.status === 'partial' ? 'warning' : 'info'}>
                  {prescription.status === 'fulfilled' ? 'Completa' : prescription.status === 'partial' ? 'Parcial' : 'Pendiente'}
                </Badge>
              </div>

              <div className="prescription-info">
                <div className="info-row">
                  <span className="label">Código:</span>
                  <span className="value">{prescription.prescription_code}</span>
                </div>
                <div className="info-row">
                  <span className="label">Paciente:</span>
                  <span className="value">{prescription.patient_name}</span>
                </div>
                <div className="info-row">
                  <span className="label">Médico:</span>
                  <span className="value">{prescription.doctor_name}</span>
                </div>
                <div className="info-row">
                  <span className="label">Fecha:</span>
                  <span className="value">
                    {new Date(prescription.prescription_date).toLocaleDateString('es-ES')}
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Medicamentos:</span>
                  <span className="value">{prescription.items_count || prescription.items?.length || 0}</span>
                </div>
              </div>

              <div className="result-actions">
                <Button
                  variant="primary"
                  onClick={handleDispense}
                  disabled={prescription.status === 'fulfilled' || prescription.status === 'cancelled'}
                >
                  Realizar Despacho
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQrCode('')
                    setManualCode('')
                    setError('')
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Modal de despacho */}
      {showDispenseModal && prescription && (
        <QRDispenseModal
          prescription={prescription}
          isOpen={showDispenseModal}
          onClose={() => setShowDispenseModal(false)}
          onSuccess={handleDispenseSuccess}
        />
      )}
    </div>
  )
}


