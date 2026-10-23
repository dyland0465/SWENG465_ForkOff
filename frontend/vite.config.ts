import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    strictPort: true,
    proxy: {
      "/socket.io": { target: "http://localhost:3000", ws: true, changeOrigin: false },
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: false,
      },
      "/api-docs": {
        target: "http://localhost:3000",
        changeOrigin: false,
      },
    },
  }
})
