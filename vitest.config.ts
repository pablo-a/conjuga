import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig } from 'vitest/config'

// Configuration séparée de vite.config.ts : les tests n'ont besoin ni du service worker
// ni de Tailwind, et les charger ralentirait chaque exécution sans rien apporter.
// Le markdown, en revanche, doit être compilé à l'identique : les fiches de théorie
// sont des composants, et un test qui ne saurait pas les monter ne vérifierait rien.
export default defineConfig({
  plugins: [vue({ include: [/\.vue$/, /\.md$/] }), Markdown({ headEnabled: false })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      include: ['src/conjugation/**', 'src/srs/**', 'src/exercises/**', 'src/db/**'],
    },
  },
})
