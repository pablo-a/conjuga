/**
 * Les fiches de théorie sont des `.md` compilés en composants Vue par
 * `unplugin-vue-markdown` (voir vite.config.ts). TypeScript ne connaît pas
 * l'extension : sans cette déclaration, importer une fiche serait une erreur de
 * compilation alors que le bundler, lui, sait la résoudre.
 */
declare module '*.md' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
