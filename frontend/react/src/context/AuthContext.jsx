import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay token guardado
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      } catch (error) {
        console.error('Error al parsear usuario:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password })
      const { token, user: userData } = response.data.data
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      setUser(userData)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar sesión'
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  const hasRole = (role) => {
    if (!user) return false
    if (user.role === 'admin') return true // Admin tiene todos los permisos
    return user.role === role
  }

  const hasAnyRole = (roles) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return roles.includes(user.role)
  }

  // Verificar si el usuario puede acceder a una ruta específica
  const canAccess = (route) => {
    if (!user) return false
    if (user.role === 'admin') return true

    // Rutas permitidas para Farmacéutico
    const farmaceuticoRoutes = [
      '/dashboard',
      '/stock',
      '/prescriptions',
      '/qr-scanner',
      '/predictions',
      '/stock-entry',
      '/stock-exit'
    ]

    // Rutas permitidas para Médico
    const medicoRoutes = [
      '/dashboard',
      '/prescriptions'
    ]

    if (user.role === 'farmaceutico') {
      return farmaceuticoRoutes.includes(route)
    }

    if (user.role === 'medico') {
      return medicoRoutes.includes(route)
    }

    return false
  }

  // Verificar si el usuario tiene un permiso específico
  const hasPermission = (permission) => {
    if (!user) return false
    if (user.role === 'admin') return true

    // Permisos específicos por rol
    const permissions = {
      farmaceutico: [
        'products.read',
        'prescriptions.read',
        'prescriptions.fulfill', // Puede despachar recetas
        'prescriptions.print',   // Puede imprimir recetas
        'predictions.read',
        'predictions.create',
        'stock.entry',
        'stock.exit'
      ]
    }

    return permissions[user.role]?.includes(permission) || false
  }

  // Verificar si el usuario puede ver información de stock
  const canViewStock = () => {
    if (!user) return false
    return user.role === 'admin'
  }

  // Verificar si el usuario puede realizar una acción (create, update, delete)
  const canPerformAction = (resource, action) => {
    if (!user) return false
    if (user.role === 'admin') return true

    if (user.role === 'farmaceutico') {
      // Farmacéutico solo puede leer productos, no editarlos
      if (resource === 'products' && action !== 'read') {
        return false
      }
      
      // Permisos específicos para recetas
      if (resource === 'prescriptions') {
        // Químico NO puede crear ni cancelar recetas
        if (action === 'create' || action === 'delete') {
          return false
        }
        // Químico NO puede actualizar (cancelar) recetas
        if (action === 'update') {
          return false
        }
        // Químico SÍ puede leer, despachar e imprimir
        if (action === 'read' || action === 'fulfill' || action === 'print') {
          return true
        }
        return false
      }
      
      // Farmacéutico puede gestionar predicciones y stock
      if (['predictions', 'stock'].includes(resource)) {
        return true
      }
    }

    return false
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasRole,
        hasAnyRole,
        canAccess,
        hasPermission,
        canPerformAction,
        canViewStock,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

