import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Habilita HTTPS con certificado autofirmado para acceso a cámara
  ],
  server: {
    port: 5173,
    host: true, // Expone el servidor a la red (accesible desde otros dispositivos)
    https: true, // Habilitar HTTPS para permisos de cámara en móviles
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false // Permitir certificado autofirmado
      },
      '/socket.io': {
        target: 'https://localhost:3000',
        ws: true,
        secure: false // Permitir certificado autofirmado
      }
    }
  }
})

