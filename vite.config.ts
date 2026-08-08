import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Le dépôt est publié sur GitHub Pages sous /<repo>/, sauf en dev où la racine suffit.
const base = process.env.VITE_BASE ?? '/'

/**
 * Duplique l'index construit en `404.html`.
 *
 * GitHub Pages sert des fichiers statiques et ne réécrit rien vers `index.html`.
 * Le routeur étant en history mode, `/conjugueur?v=tener` fonctionne par
 * navigation interne mais renverrait la page 404 de GitHub s'il était rechargé
 * ou partagé — c'est-à-dire exactement l'usage pour lequel l'URL porte le verbe.
 *
 * GitHub sert ce fichier avec un statut 404 : l'app démarre et affiche la bonne
 * route, mais le code HTTP reste inexact. C'est le prix de l'hébergement
 * statique, et il ne se paie qu'au tout premier chargement d'un lien profond —
 * ensuite le service worker prend la main sur la navigation.
 *
 * On copie l'index *construit*, jamais celui des sources : lui seul porte les
 * noms de fichiers hachés et la base d'URL du déploiement.
 */
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'conjuga:404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    // Avant VitePWA dans la liste des plugins, pour que Workbox trouve le
    // fichier et le précache comme le reste.
    closeBundle() {
      const root = fileURLToPath(new URL('.', import.meta.url))
      const directory = resolve(root, outDir)
      copyFileSync(resolve(directory, 'index.html'), resolve(directory, '404.html'))
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    spaFallback(),
    // `include` étend le plugin Vue aux `.md` : les fiches de théorie sont
    // compilées en composants, pas en chaînes de HTML. C'est ce qui leur permet
    // d'appeler <ConjugationTable>, donc de tirer leurs tableaux du moteur au
    // lieu de les recopier — une fiche ne peut pas enseigner une forme que
    // l'app corrigerait autrement.
    /*
     * `include` restreint au fichier lui-même. Le filtre par défaut du plugin
     * couvre aussi les sous-requêtes `.md?vue&type=script`, que le plugin Vue
     * émet **après** avoir compilé le bloc : le markdown s'appliquerait alors au
     * JavaScript déjà produit, qui repartirait enveloppé dans un `<p>`. L'erreur
     * qui en sort ne désigne rien de compréhensible.
     */
    Markdown({ include: /\.md$/, headEnabled: false }),
    vue({ include: [/\.vue$/, /\.md$/] }),
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
