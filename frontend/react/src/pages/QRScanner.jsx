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
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [requestingPermission, setRequestingPermission] = useState(false)
  const scannerRef = useRef(null)

  // Función para solicitar permisos explícitamente
  const requestCameraPermission = async () => {
    try {
      setRequestingPermission(true)
      setError('')
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara.')
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())
      setCameraPermissionGranted(true)
      setError('') // Limpiar errores anteriores
      
      // Listar cámaras disponibles después de obtener permisos
      try {
        const devices = await Html5Qrcode.getCameras()
        if (devices && devices.length > 0) {
          setAvailableCameras(devices)
          const backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
          )
          setSelectedCameraId(backCamera ? backCamera.id : devices[devices.length - 1].id) // Usar la última si no hay trasera
        }
      } catch (camErr) {
        console.log('No se pudieron listar las cámaras:', camErr)
      }
    } catch (err) {
      console.error('Error al solicitar permisos:', err)
      
      // Si el usuario canceló, no mostrar error
      if (err.name === 'NotAllowedError' && (err.message?.includes('cancel') || err.message?.includes('denied'))) {
        setError('')
        setCameraPermissionGranted(false)
        return
      }
      
      let errorMsg = 'No se pudieron obtener los permisos de cámara. '
      if (err.name === 'NotAllowedError') {
        errorMsg += 'Por favor, permite el acceso a la cámara en la configuración del navegador.'
      } else if (err.name === 'NotFoundError') {
        errorMsg += 'No se encontró ninguna cámara disponible.'
      } else {
        errorMsg += err.message || 'Verifica la configuración de tu navegador.'
      }
      setError(errorMsg)
    } finally {
      setRequestingPermission(false)
    }
  }

  // Verificar permisos de cámara y listar cámaras disponibles
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Intentar obtener permisos
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach(track => track.stop()) // Detener inmediatamente
          setCameraPermissionGranted(true)
          
          // Listar cámaras disponibles
          try {
            const devices = await Html5Qrcode.getCameras()
            if (devices && devices.length > 0) {
              setAvailableCameras(devices)
              // Seleccionar cámara trasera por defecto si está disponible
              const backCamera = devices.find(device => 
                device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('rear') ||
                device.label.toLowerCase().includes('environment')
              )
              setSelectedCameraId(backCamera ? backCamera.id : devices[0].id)
            }
          } catch (camErr) {
            console.log('No se pudieron listar las cámaras:', camErr)
          }
        } else {
          // Verificar si estamos en localhost (puede requerir HTTPS)
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setError('Tu navegador requiere HTTPS para acceder a la cámara. Por favor usa el input manual o accede mediante HTTPS.')
          } else {
            setError('Tu navegador no soporta acceso a la cámara. Por favor usa el input manual.')
          }
        }
      } catch (err) {
        console.log('Permisos de cámara no otorgados aún:', err.message)
        setCameraPermissionGranted(false)
      }
    }
    checkCameraPermission()
  }, [])

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
        try {
          scanner.stop().catch(() => {})
          scanner.clear().catch(() => {})
        } catch (e) {
          // Ignorar todos los errores de limpieza
        }
      }
    }
  }, [scanner])

  const startScanning = async () => {
    try {
      setError('')
      setScanning(true)
      
      // Verificar si hay dispositivos de cámara disponibles
      const devices = await Html5Qrcode.getCameras()
      if (!devices || devices.length === 0) {
        throw new Error('No se encontraron cámaras disponibles en este dispositivo.')
      }
      
      console.log('Cámaras disponibles:', devices.length, devices.map(d => ({ id: d.id, label: d.label })))
      
      const html5QrCode = new Html5Qrcode('qr-reader')
      
      // Determinar qué cámara usar
      let cameraId = selectedCameraId
      
      // Si no hay cámara seleccionada, intentar encontrar la mejor
      if (!cameraId) {
        // Priorizar cámara trasera si está disponible
        const backCamera = devices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment') ||
          device.label.toLowerCase().includes('trasera')
        )
        cameraId = backCamera ? backCamera.id : devices[devices.length - 1].id // Usar la última si no hay trasera
      }
      
      // Intentar iniciar con la cámara seleccionada
      let lastError = null
      let cameraIndex = devices.findIndex(d => d.id === cameraId)
      if (cameraIndex === -1) cameraIndex = 0
      
      // Intentar con todas las cámaras si la primera falla
      for (let i = 0; i < devices.length; i++) {
        const currentCameraId = devices[cameraIndex].id
        const currentCameraLabel = devices[cameraIndex].label
        
        try {
          console.log(`Intentando con cámara ${i + 1}/${devices.length}: ${currentCameraLabel || currentCameraId}`)
          
          await html5QrCode.start(
            currentCameraId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0
            },
            (decodedText) => {
              // QR detectado
              handleQRDetected(decodedText)
            },
            (errorMessage) => {
              // Ignorar errores de escaneo continuo (no es un QR válido aún)
              // No mostrar estos errores al usuario
            }
          )
          
          // Si llegamos aquí, la cámara funcionó
          console.log(`✅ Cámara funcionando: ${currentCameraLabel || currentCameraId}`)
          setSelectedCameraId(currentCameraId)
          setScanner(html5QrCode)
          return // Salir del bucle si funciona
          
        } catch (camErr) {
          console.warn(`❌ Cámara ${i + 1} falló:`, camErr.message)
          lastError = camErr
          
          // Si el usuario canceló, no intentar con otras cámaras
          if (camErr.name === 'NotAllowedError' || camErr.message?.includes('cancel') || camErr.message?.includes('denied')) {
            throw camErr // Re-lanzar para que se maneje como cancelación
          }
          
          // Limpiar el scanner antes de intentar con la siguiente
          try {
            await html5QrCode.stop().catch(() => {})
            await html5QrCode.clear().catch(() => {})
          } catch (cleanErr) {
            // Ignorar errores de limpieza, especialmente "not running"
            if (!cleanErr.message?.includes('not running') && !cleanErr.message?.includes('paused')) {
              console.log('Error al limpiar (ignorado):', cleanErr.message)
            }
          }
          
          // Intentar con la siguiente cámara
          cameraIndex = (cameraIndex + 1) % devices.length
        }
      }
      
      // Si llegamos aquí, ninguna cámara funcionó
      throw lastError || new Error('No se pudo acceder a ninguna cámara disponible.')
      
    } catch (err) {
      console.error('Error al iniciar escáner:', err)
      
      // Si el usuario canceló, no mostrar error
      if (err.name === 'NotAllowedError' && err.message?.includes('cancel')) {
        setError('')
        setScanning(false)
        setScanner(null)
        return
      }
      
      let errorMessage = 'No se pudo acceder a la cámara. '
      
      if (err.name === 'NotAllowedError' || err.message?.includes('permission') || err.message?.includes('denied')) {
        errorMessage += 'El acceso a la cámara fue denegado. Por favor, permite el acceso a la cámara en la configuración del navegador.'
      } else if (err.name === 'NotFoundError' || err.message?.includes('camera') || err.message?.includes('dispositivo')) {
        errorMessage += 'No se encontró ninguna cámara disponible. Verifica que tu dispositivo tenga una cámara conectada.'
      } else if (err.message && !err.message.includes('not running') && !err.message.includes('paused')) {
        errorMessage += err.message
      } else {
        errorMessage += 'Verifica los permisos o usa el input manual.'
      }
      
      setError(errorMessage)
      setScanning(false)
      
      // Limpiar scanner si se creó, ignorando errores de "not running"
      if (scanner) {
        try {
          await scanner.stop().catch((stopErr) => {
            if (!stopErr.message?.includes('not running') && !stopErr.message?.includes('paused')) {
              console.error('Error al detener scanner:', stopErr)
            }
          })
          await scanner.clear().catch(() => {})
        } catch (e) {
          // Ignorar todos los errores de limpieza
        }
        setScanner(null)
      }
    }
  }

  const stopScanning = async () => {
    // Actualizar estados primero para evitar problemas de UI
    setScanning(false)
    
    if (scanner) {
      const currentScanner = scanner
      setScanner(null) // Limpiar referencia inmediatamente
      
      try {
        // Verificar si el scanner tiene el método getState para saber su estado
        const isRunning = currentScanner.getState && currentScanner.getState() === 2 // 2 = SCANNING
        
        if (isRunning) {
          await currentScanner.stop()
        }
      } catch (stopErr) {
        // Ignorar TODOS los errores de stop - son esperados si el scanner no está corriendo
        console.log('Stop scanner (ignorado):', stopErr.message)
      }
      
      try {
        await currentScanner.clear()
      } catch (clearErr) {
        // Ignorar errores de limpieza
        console.log('Clear scanner (ignorado):', clearErr.message)
      }
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
    // No cerrar el modal automáticamente - el usuario puede seguir despachando
    // Solo refrescar los datos de la receta
    refetch()
  }

  const handleDispenseModalClose = () => {
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
                <>
                  {!cameraPermissionGranted ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
                      <Button
                        variant="primary"
                        onClick={requestCameraPermission}
                        icon={<HiCamera />}
                        loading={requestingPermission}
                        fullWidth
                      >
                        Solicitar Permisos de Cámara
                      </Button>
                      <div style={{ 
                        fontSize: 'var(--font-size-sm)', 
                        color: 'var(--color-gray-600)', 
                        textAlign: 'center',
                        padding: '0.75rem 1rem',
                        background: 'var(--color-info-light)',
                        borderRadius: 'var(--border-radius-md)',
                        borderLeft: '4px solid var(--color-info)',
                        fontWeight: 'var(--font-weight-medium)'
                      }}>
                        💡 Primero necesitas otorgar permisos de cámara al navegador
                      </div>
                    </div>
                  ) : (
                    <>
                      {availableCameras.length > 1 && (
                        <div style={{ marginBottom: '1rem', width: '100%', maxWidth: '400px' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                            Seleccionar cámara antes de activar:
                          </label>
                          <select
                            value={selectedCameraId || availableCameras[availableCameras.length - 1]?.id || ''}
                            onChange={(e) => setSelectedCameraId(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '0.875rem',
                              marginBottom: '0.5rem'
                            }}
                          >
                            {availableCameras.map((camera, index) => (
                              <option key={camera.id} value={camera.id}>
                                {camera.label || `Cámara ${index + 1}`}
                              </option>
                            ))}
                          </select>
                          <div style={{ 
                            fontSize: 'var(--font-size-xs)', 
                            color: 'var(--color-gray-600)', 
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            background: 'var(--color-warning-light)',
                            borderRadius: 'var(--border-radius-sm)',
                            borderLeft: '3px solid var(--color-warning)',
                            marginTop: '0.5rem'
                          }}>
                            💡 Si la primera cámara no funciona, selecciona la segunda antes de activar
                          </div>
                        </div>
                      )}
                      <Button
                        variant="primary"
                        onClick={startScanning}
                        icon={<HiCamera />}
                      >
                        Activar Cámara
                      </Button>
                      {availableCameras.length > 0 && (
                        <div style={{ 
                          marginTop: '0.5rem', 
                          padding: '0.75rem 1rem',
                          background: 'var(--color-success-light)',
                          borderRadius: 'var(--border-radius-md)',
                          borderLeft: '4px solid var(--color-success)',
                          textAlign: 'center',
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-gray-700)',
                          fontWeight: 'var(--font-weight-medium)'
                        }}>
                          ✓ {availableCameras.length} cámara(s) disponible(s)
                        </div>
                      )}
                    </>
                  )}
                </>
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
                {availableCameras.length > 1 && (
                  <div style={{ marginBottom: '1rem', width: '100%' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                      Seleccionar cámara:
                    </label>
                    <select
                      value={selectedCameraId || ''}
                      onChange={async (e) => {
                        const newCameraId = e.target.value
                        setSelectedCameraId(newCameraId)
                        
                        // Detener escáner actual de forma segura
                        setScanning(false)
                        if (scanner) {
                          const currentScanner = scanner
                          setScanner(null)
                          try {
                            await currentScanner.stop().catch(() => {})
                            await currentScanner.clear().catch(() => {})
                          } catch (err) {
                            // Ignorar todos los errores
                            console.log('Cambio de cámara - limpieza (ignorado):', err.message)
                          }
                        }
                        
                        // Reiniciar con nueva cámara después de un breve delay
                        setTimeout(() => {
                          startScanning()
                        }, 300)
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.875rem'
                      }}
                    >
                      {availableCameras.map((camera, index) => (
                        <option key={camera.id} value={camera.id}>
                          {camera.label || `Cámara ${index + 1}`} {camera.id === selectedCameraId ? '(En uso)' : ''}
                        </option>
                      ))}
                    </select>
                    <div style={{ 
                      marginTop: '0.5rem', 
                      fontSize: 'var(--font-size-xs)', 
                      color: 'var(--color-gray-600)',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--color-warning-light)',
                      borderRadius: 'var(--border-radius-sm)',
                      borderLeft: '3px solid var(--color-warning)'
                    }}>
                      💡 Si la primera cámara no funciona, selecciona la segunda cámara del menú
                    </div>
                  </div>
                )}
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
              <div>
                <strong>{error}</strong>
                {(error.includes('permiso') || error.includes('permission')) && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    <strong>Instrucciones para otorgar permisos:</strong>
                    <ul style={{ marginTop: '0.25rem', paddingLeft: '1.5rem', textAlign: 'left' }}>
                      <li><strong>Chrome/Edge:</strong> Haz clic en el ícono de candado en la barra de direcciones → Permisos → Cámara → Permitir</li>
                      <li><strong>Firefox:</strong> Haz clic en el ícono de candado → Permisos → Cámara → Permitir</li>
                      <li><strong>Brave:</strong> Configuración → Privacidad → Permisos del sitio → Cámara</li>
                    </ul>
                    <p style={{ marginTop: '0.5rem' }}>
                      También puedes usar el <strong>input manual</strong> ingresando el código de la receta directamente.
                    </p>
                  </div>
                )}
              </div>
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
          onClose={handleDispenseModalClose}
          onSuccess={handleDispenseSuccess}
        />
      )}
    </div>
  )
}


