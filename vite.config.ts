import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Le dépôt est publié sur GitHub Pages sous /<repo>/, sauf en dev où la racine suffit.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // L'app doit être intégralement utilisable hors ligne : on précache tout,
      // y compris les données de conjugaison et le contenu théorique.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Conjuga — conjugaison espagnole',
        short_name: 'Conjuga',
        description:
          'Apprendre la conjugaison espagnole par répétition espacée, pensé pour les francophones.',
        lang: 'fr',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
