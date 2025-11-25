import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Loading from './Loading'

export default function ProtectedRoute({ children, requiredRole, requiredPermission }) {
  const { isAuthenticated, loading, canAccess, hasPermission, hasRole, user } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Loading fullScreen text="Verificando acceso..." />
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // PRIMERO: Si es médico, verificar rutas permitidas ANTES de renderizar Layout
  if (user.role === 'medico') {
    // Médicos solo pueden acceder a /prescriptions o / (raíz)
    const allowedPaths = ['/prescriptions', '/']
    if (!allowedPaths.includes(location.pathname)) {
      return <Navigate to="/prescriptions" replace />
    }
  }

  // Verificar acceso a la ruta
  if (!canAccess(location.pathname)) {
    // Redirigir según el rol del usuario
    if (user.role === 'medico') {
      return <Navigate to="/prescriptions" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  // Verificar rol requerido
  if (requiredRole && !hasRole(requiredRole)) {
    // Redirigir según el rol del usuario
    if (user.role === 'medico') {
      return <Navigate to="/prescriptions" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  // Verificar permiso requerido
  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Redirigir según el rol del usuario
    if (user.role === 'medico') {
      return <Navigate to="/prescriptions" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return children
}

