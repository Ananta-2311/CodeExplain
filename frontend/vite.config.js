/**
 * Vite config for the CodeMuse SPA (React plugin, default dev server).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})

