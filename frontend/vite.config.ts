import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// stellar-sdk bazı yerlerde `global`/`Buffer` bekliyor; tarayıcıda karşılığını veriyoruz.
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    host: true,
    allowedHosts: true,
  },
})
