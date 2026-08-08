import Dexie, { type EntityTable } from 'dexie'

import type { CardState } from '@/srs/scheduler'
import { dayKey } from '@/srs/streak'

/**
 * Persistance locale. Aucun serveur : toute la progression vit dans IndexedDB,
 * et l'export/import JSON est le seul mécanisme de sauvegarde.
 *
 * Une `Card` est un couple (lemma, tense) — la personne est tirée au sort à chaque
 * révision, elle ne fait donc pas partie de l'identité de la carte. Voir PLAN.md §2.
 */

/** État de répétition espacée d'un couple (lemma, tense). */
export interface Card {
  id: string
  /** Infinitif espagnol, ex. `pensar`. */
  lemma: string
  /** Identifiant de temps, ex. `indicativo.presente`. */
  tense: string
  /**
   * État FSRS de la carte. Il est rangé tel quel : `ts-fsrs` n'expose que des
   * nombres et des `Date`, que le clonage structuré d'IndexedDB sait déjà porter,
   * et le sérialiser à la main ferait deux formats à maintenir au lieu d'un.
   */
  fsrs: CardState
  /** Prochaine échéance, dénormalisée pour pouvoir l'indexer. */
  due: Date
  /** Nombre de révisions et d'échecs, pour les statistiques. */
  reps: number
  lapses: number
}

/** Une réponse individuelle, conservée pour les statistiques par personne et par modèle. */
export interface Answer {
  id?: number
  cardId: string
  answeredAt: Date
  person: string
  expected: string
  given: string
  correct: boolean
  /** Vrai quand la seule erreur portait sur un accent : on le distingue d'une faute de forme. */
  accentOnly: boolean
  /** Durée de réflexion en millisecondes, utilisée pour le budget temps de la session. */
  elapsedMs: number
}

/** Agrégat par (modèle, temps) : c'est lui qui pilote les suggestions de théorie. */
export interface PatternStat {
  id: string
  model: string
  tense: string
  attempts: number
  errors: number
}

/**
 * Un jour où l'apprenant s'est mis à sa session.
 *
 * C'est un agrégat, pas un cache : la série et le « déjà fait aujourd'hui » de
 * l'accueil se lisent à chaque ouverture de l'app, et les recalculer depuis le
 * journal des réponses ferait de la requête la plus fréquente la plus coûteuse —
 * une année de sessions pèse ~40 000 réponses pour 365 jours.
 */
export interface StudyDay {
  /** Jour civil local, `AAAA-MM-JJ`. Voir `dayKey` pour le choix du fuseau. */
  id: string
  /** Cartes révisées ce jour-là, toutes sessions confondues. */
  cards: number
  /** Formes demandées ce jour-là. */
  answers: number
}

export const db = new Dexie('conjuga') as Dexie & {
  cards: EntityTable<Card, 'id'>
  answers: EntityTable<Answer, 'id'>
  patternStats: EntityTable<PatternStat, 'id'>
  days: EntityTable<StudyDay, 'id'>
}

db.version(1).stores({
  cards: 'id, lemma, tense, due',
  answers: '++id, cardId, answeredAt',
  patternStats: 'id, model, tense',
})

db.version(2)
  .stores({ days: 'id' })
  .upgrade(async (transaction) => {
    /*
     * La table est dérivable du journal des réponses, qui existe déjà : une base
     * déjà remplie doit retrouver sa série intacte, sinon la migration punirait
     * l'apprenant le plus assidu — celui qui a le plus de jours à perdre.
     */
    const answers = await transaction.table<Answer>('answers').toArray()

    const days = new Map<string, { cards: Set<string>; answers: number }>()
    for (const answer of answers) {
      const key = dayKey(answer.answeredAt)
      const day = days.get(key) ?? { cards: new Set<string>(), answers: 0 }
      day.cards.add(answer.cardId)
      day.answers += 1
      days.set(key, day)
    }

    await transaction
      .table<StudyDay>('days')
      .bulkAdd([...days].map(([id, day]) => ({ id, cards: day.cards.size, answers: day.answers })))
  })
