import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import { loadPatternStats } from '@/db/repository'
import type { Sheet } from '@/content'
import { isMeaningful, successRate, totalFor, weakest } from '@/srs/patterns'
import type { PatternCount, Score } from '@/srs/patterns'

/**
 * Ce que la progression dit des fiches de théorie.
 *
 * `patternStats` était écrit depuis la boucle quotidienne sans avoir de lecteur ;
 * c'est ici qu'il en trouve un. Le magasin lit et délègue : le seuil de
 * significativité et le classement des faiblesses vivent dans `srs/patterns.ts`.
 */

export type TheoryStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Ce qu'on sait de la maîtrise d'une fiche. */
export interface SheetScore {
  score: Score
  /** Taux de réussite, entre 0 et 1. N'a de sens que si `meaningful`. */
  rate: number
  /** Faux tant que trop peu de formes ont été demandées pour conclure. */
  meaningful: boolean
}

export const useTheoryStore = defineStore('theory', () => {
  const status = ref<TheoryStatus>('idle')
  const error = ref<string | null>(null)
  const stats = shallowRef<PatternCount[]>([])

  async function load(): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      stats.value = await loadPatternStats()
      status.value = 'ready'
    } catch (cause) {
      // La théorie reste lisible sans statistiques : c'est l'indicateur qui
      // manque, pas le contenu. On le dit sans masquer les fiches.
      error.value = cause instanceof Error ? cause.message : String(cause)
      status.value = 'error'
    }
  }

  function scoreOf(sheet: Sheet): SheetScore {
    const score = totalFor(stats.value, sheet.tenses)
    return { score, rate: successRate(score), meaningful: isMeaningful(score) }
  }

  /** Les patrons les plus ratés parmi les temps de la fiche. */
  function weaknessesOf(sheet: Sheet): PatternCount[] {
    return weakest(stats.value, sheet.tenses)
  }

  return { status, error, stats, load, scoreOf, weaknessesOf }
})
