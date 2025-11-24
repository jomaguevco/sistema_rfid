import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para agregar token a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('🔑 Token agregado a petición:', config.url)
    } else {
      console.warn('⚠️ No hay token disponible para:', config.url)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejar errores 401 (No autorizado) y 403 (Prohibido)
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('❌ Error de autenticación:', {
        status: error.response.status,
        message: error.response.data?.error,
        path: error.config?.url
      })
      
      // Limpiar datos de sesión
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      delete api.defaults.headers.common['Authorization']
      
      // Redirigir al login solo si no estamos ya en la página de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

