import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const auth = useAuth()
  const isAuthenticated = auth?.isAuthenticated || false

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setConnected(false)
      }
      return
    }

    try {
      const token = localStorage.getItem('token')
      const newSocket = io('http://localhost:3000', {
        auth: {
          token
        },
        transports: ['websocket', 'polling']
      })

      newSocket.on('connect', () => {
        console.log('✅ Conectado al servidor Socket.IO')
        setConnected(true)
      })

      newSocket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor Socket.IO')
        setConnected(false)
      })

      newSocket.on('connect_error', (error) => {
        console.error('❌ Error de conexión Socket.IO:', error)
        setConnected(false)
      })

      setSocket(newSocket)

      return () => {
        newSocket.disconnect()
      }
    } catch (error) {
      console.error('Error al inicializar Socket.IO:', error)
    }
  }, [isAuthenticated])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket debe usarse dentro de SocketProvider')
  }
  return context
}

