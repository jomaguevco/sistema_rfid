import React from 'react'
import './ErrorBoundary.css'

// Lista de errores que deben ser ignorados (errores esperados del escáner QR)
const IGNORED_ERRORS = [
  'Cannot stop',
  'not running',
  'not paused',
  'scanner is not running',
  'IndexSizeError',
  'getImageData'
]

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    // Verificar si es un error que debe ser ignorado
    const errorMessage = error?.message || error?.toString() || ''
    const shouldIgnore = IGNORED_ERRORS.some(ignored => 
      errorMessage.toLowerCase().includes(ignored.toLowerCase())
    )
    
    if (shouldIgnore) {
      console.log('ErrorBoundary: Ignorando error esperado del escáner:', errorMessage)
      return null // No actualizar el estado, ignorar el error
    }
    
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Verificar si es un error que debe ser ignorado
    const errorMessage = error?.message || error?.toString() || ''
    const shouldIgnore = IGNORED_ERRORS.some(ignored => 
      errorMessage.toLowerCase().includes(ignored.toLowerCase())
    )
    
    if (shouldIgnore) {
      console.log('ErrorBoundary: Error del escáner ignorado:', errorMessage)
      // Resetear el estado de error si se capturó por accidente
      this.setState({ hasError: false, error: null })
      return
    }
    
    console.error('Error capturado por ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>⚠️ Error en la aplicación</h1>
            <p>Ha ocurrido un error inesperado. Por favor, recarga la página.</p>
            <details>
              <summary>Detalles del error</summary>
              <pre>{this.state.error?.toString()}</pre>
            </details>
            <button onClick={() => window.location.reload()}>
              Recargar página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

