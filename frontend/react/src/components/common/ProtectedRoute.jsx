import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Loading from './Loading'

export default function ProtectedRoute({ children, requiredRole, requiredPermission }) {
  const { isAuthenticated, loading, canAccess, hasPermission, hasRole } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Loading fullScreen text="Verificando acceso..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Verificar acceso a la ruta
  if (!canAccess(location.pathname)) {
    return <Navigate to="/dashboard" replace />
  }

  // Verificar rol requerido
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/dashboard" replace />
  }

  // Verificar permiso requerido
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

