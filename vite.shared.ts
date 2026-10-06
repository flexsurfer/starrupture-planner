import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { UserConfig } from 'vite'

export function createSharedViteConfig(): UserConfig {
  return {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Subpath imports (e.g. react-dom/client) are separate module ids; match the package path.
          if (id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/scheduler')) {
            return 'react-vendor'
          }
          // react/ but not react-dom (react-dom paths contain "react-dom", not "react/" right after react)
          if (id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/@xyflow') || id.includes('node_modules/dagre')) {
            return 'xyflow'
          }
        },
      },
    },
  },
  }
}
