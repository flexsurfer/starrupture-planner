import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { UserConfig } from 'vite'

function appRelease(): string {
  if (process.env.VITE_APP_RELEASE) return process.env.VITE_APP_RELEASE.slice(0, 128)
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  } catch {
    return 'unknown'
  }
}

export function createSharedViteConfig(): UserConfig {
  const builtAt = new Date().toISOString()
  // Private website changes may not change Git HEAD. Every build needs its own version.
  const version = process.env.VITE_APP_VERSION?.trim()
    || builtAt.slice(0, 19).replaceAll('-', '.').replace('T', '-').replaceAll(':', '')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,63}$/.test(version)) {
    throw new Error('VITE_APP_VERSION must be 1–64 letters, digits, dots, plus signs, underscores or hyphens.')
  }
  const buildInfo = { version, release: appRelease(), builtAt }
  return {
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
    'import.meta.env.VITE_APP_RELEASE': JSON.stringify(buildInfo.release),
    // Only the private website build may opt in; standalone builds always stay off.
    'import.meta.env.VITE_UMAMI_ENABLED': JSON.stringify('false'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react(), tailwindcss(), {
    name: 'app-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(buildInfo) + '\n' })
    },
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'app-version', content: version }, injectTo: 'head' }]
    },
  }],
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
