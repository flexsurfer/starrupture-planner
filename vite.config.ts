/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { createSharedViteConfig } from './vite.shared'

export default defineConfig({
  ...createSharedViteConfig(),
  publicDir: 'assets',
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/features/**/events.ts',
        'src/features/**/subscriptions.ts',
        'src/features/bases/derived-subscriptions.ts',
        'src/platform/headless/effects.ts',
      ],
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/headless-e2e',
      thresholds: {
        statements: 99,
        branches: 85,
        functions: 98,
        lines: 99,
      },
    },
  },
})
