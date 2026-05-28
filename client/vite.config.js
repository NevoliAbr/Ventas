import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Redirige las llamadas /api al backend de Node durante el desarrollo,
    // así el frontend usa rutas relativas (/api/ventas) sin problemas de CORS.
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
