import type { Component } from 'vue'

import type { Tense } from '@/conjugation'

import IndefinidoVsImperfecto from './indefinido-vs-imperfecto.md'
import Presente from './presente.md'

/**
 * Les fiches de théorie, et le temps auquel chacune répond.
 *
 * Une fiche est un `.md` compilé en composant Vue (voir vite.config.ts) : elle
 * s'écrit comme du texte mais peut appeler `<ConjugationTable>`. Ses tableaux de
 * formation sortent donc du moteur, et ne peuvent pas diverger de ce que l'app
 * corrige — une fiche qui enseignerait `piensamos` pendant que la Pratique le
 * refuse serait pire que pas de fiche du tout.
 */

export interface Sheet {
  /** Segment d'URL, en français comme le reste des routes. */
  slug: string
  title: string
  /** Ce que la fiche enseigne, en une phrase, pour la liste. */
  summary: string
  /**
   * Les temps que la fiche couvre. Sert à deux choses : mesurer la maîtrise
   * affichée en regard, et savoir vers quelle fiche la Pratique renvoie après
   * une correction.
   */
  tenses: readonly Tense[]
  component: Component
}

/**
 * L'ordre compte : `sheetFor` retient la **première** fiche qui couvre un temps.
 * Les fiches dédiées passent donc avant les transversales, et le jour où
 * `indefinido` et `imperfecto` auront chacune la leur, elles se glisseront
 * au-dessus sans que rien d'autre ne bouge.
 */
const sheets: Sheet[] = [
  {
    slug: 'present',
    title: 'Le présent de l’indicatif',
    summary:
      'La botte des diphtongues, les premières personnes en -go et -zco, et pourquoi on n’écrit pas le pronom sujet.',
    tenses: ['indicativo.presente'],
    component: Presente,
  },
  {
    slug: 'indefinido-ou-imperfecto',
    title: 'Indefinido ou imperfecto',
    summary:
      'Le piège numéro un du francophone : la ligne de partage espagnole n’est pas celle du passé composé et de l’imparfait.',
    tenses: ['indicativo.indefinido', 'indicativo.imperfecto'],
    component: IndefinidoVsImperfecto,
  },
]

export const SHEETS: readonly Sheet[] = sheets

export function sheetBySlug(slug: string): Sheet | undefined {
  return sheets.find((sheet) => sheet.slug === slug)
}

/** La fiche vers laquelle renvoyer après une question à ce temps, s'il y en a une. */
export function sheetFor(tense: Tense): Sheet | undefined {
  return sheets.find((sheet) => sheet.tenses.includes(tense))
}
