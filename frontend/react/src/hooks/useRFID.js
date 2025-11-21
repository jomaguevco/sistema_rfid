import { useEffect, useState, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'

export function useRFID(options = {}) {
  const { socket, connected } = useSocket()
  const [lastRFID, setLastRFID] = useState(null)
  const [listening, setListening] = useState(false)

  const { onDetect, onEntry, onExit, autoProcess = false } = options

  useEffect(() => {
    if (!socket || !connected || !listening) return

    const handleRFIDDetected = (data) => {
      const rfidUid = (data.rfid_uid || '').toUpperCase().trim()
      if (!rfidUid) return

      setLastRFID({
        uid: rfidUid,
        action: data.action || 'detected',
        timestamp: new Date().toISOString()
      })

      if (onDetect) {
        onDetect(rfidUid, data)
      }
    }

    const handleRFIDEntry = (data) => {
      const rfidUid = (data.rfid_uid || '').toUpperCase().trim()
      if (rfidUid && onEntry) {
        onEntry(rfidUid, data)
      }
    }

    const handleRFIDExit = (data) => {
      const rfidUid = (data.rfid_uid || '').toUpperCase().trim()
      if (rfidUid && onExit) {
        onExit(rfidUid, data)
      }
    }

    socket.on('rfidDetected', handleRFIDDetected)
    socket.on('rfidEntry', handleRFIDEntry)
    socket.on('rfidExit', handleRFIDExit)

    return () => {
      socket.off('rfidDetected', handleRFIDDetected)
      socket.off('rfidEntry', handleRFIDEntry)
      socket.off('rfidExit', handleRFIDExit)
    }
  }, [socket, connected, listening, onDetect, onEntry, onExit])

  const startListening = useCallback(() => {
    setListening(true)
  }, [])

  const stopListening = useCallback(() => {
    setListening(false)
    setLastRFID(null)
  }, [])

  return {
    lastRFID,
    listening,
    connected,
    startListening,
    stopListening
  }
}

