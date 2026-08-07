import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Configuration séparée de vite.config.ts : les tests n'ont besoin ni du service worker
// ni de Tailwind, et les charger ralentirait chaque exécution sans rien apporter.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      include: ['src/conjugation/**', 'src/srs/**', 'src/exercises/**'],
    },
  },
})
