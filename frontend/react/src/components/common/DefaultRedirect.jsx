import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Loading from './Loading'

export default function DefaultRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return <Loading fullScreen text="Cargando..." />
  }

  // Redirigir según el rol del usuario
  if (user?.role === 'medico') {
    return <Navigate to="/prescriptions" replace />
  }

  return <Navigate to="/dashboard" replace />
}

