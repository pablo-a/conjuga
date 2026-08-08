import type { Tense } from '@/conjugation'

/**
 * Ordre d'affichage des temps dans le Conjugueur.
 *
 * Il ne suit pas celui de `TENSES`, qui range d'abord tous les temps simples puis
 * tous les composés. Ici chaque temps composé suit immédiatement le temps simple
 * qui lui fournit son auxiliaire — `perfecto` après `presente`,
 * `pluscuamperfecto` après `imperfecto`. C'est la présentation des grammaires, et
 * elle rend visible la seule chose à retenir : un temps composé, c'est `haber` au
 * temps simple correspondant, plus le participe.
 *
 * `conjugator.test.ts` vérifie que cette liste couvre exactement `TENSES` : un
 * temps ajouté au moteur ne doit pas disparaître de l'écran en silence.
 */
export interface Mood {
  name: string
  tenses: readonly Tense[]
}

export const MOODS: readonly Mood[] = [
  {
    name: 'Indicatif',
    tenses: [
      'indicativo.presente',
      'indicativo.perfecto',
      'indicativo.imperfecto',
      'indicativo.pluscuamperfecto',
      'indicativo.indefinido',
      'indicativo.anterior',
      'indicativo.futuro',
      'indicativo.futuroPerfecto',
      'indicativo.condicional',
      'indicativo.condicionalPerfecto',
    ],
  },
  {
    name: 'Subjonctif',
    tenses: [
      'subjuntivo.presente',
      'subjuntivo.perfecto',
      'subjuntivo.imperfecto',
      'subjuntivo.pluscuamperfecto',
      'subjuntivo.futuro',
    ],
  },
  {
    name: 'Impératif',
    tenses: ['imperativo.afirmativo', 'imperativo.negativo'],
  },
]
