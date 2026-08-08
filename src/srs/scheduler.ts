import { Rating, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs'
import type { Card as FsrsCard, Grade as FsrsGrade } from 'ts-fsrs'

import type { Verdict } from '@/exercises/grading'

/**
 * Répétition espacée : conversion entre le vocabulaire du projet et celui de
 * `ts-fsrs`. Module pur, sans persistance — c'est `src/db` qui range l'état.
 *
 * Une **carte** est un couple `(lemma, tense)` : la personne est tirée au sort à
 * chaque révision et ne fait donc pas partie de son identité (PLAN.md §2). Une
 * révision pose 2 à 3 personnes, et c'est l'ensemble qui reçoit une note.
 */

/**
 * Paramètres FSRS par défaut, sans optimisation personnalisée : PLAN.md §11 range
 * explicitement le réglage fin du SRS dans la sur-ingénierie.
 *
 * Le flou (`fuzz`) est en revanche désactivé. Il disperse les échéances pour
 * éviter que des cartes apprises ensemble ne reviennent toujours ensemble, mais
 * il rend l'ordonnancement non déterministe — donc intestable. Le volume visé
 * (~45 cartes par jour) ne produit de toute façon pas les gros paquets qu'il sert
 * à casser.
 */
const PARAMETERS = generatorParameters({ enable_fuzz: false })
const engine = fsrs(PARAMETERS)

/** L'état FSRS d'une carte, tel qu'il est rangé dans IndexedDB. */
export type CardState = FsrsCard

/**
 * Note attribuée à une révision.
 *
 * `hard` s'écarte de PLAN.md §6, qui n'envisageait que `again`, `good` et `easy`.
 * L'usage l'a imposé : pour un francophone, la faute d'accent est l'erreur la plus
 * fréquente et la moins grave — il a trouvé la forme et manqué la syllabe tonique.
 * La compter comme un échec complet ramènerait sans cesse des cartes acquises et
 * rendrait la session décourageante, alors que `hard` dit exactement ce qu'il faut :
 * su, mais fragile.
 */
export type Grade = 'again' | 'hard' | 'good' | 'easy'

const RATINGS: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

/** Ce qu'une question de la révision a donné. */
export interface QuestionOutcome {
  verdict: Verdict
  /** Temps de réflexion, en millisecondes. */
  elapsedMs: number
}

/**
 * Sous ce temps de réponse, la forme est **sue**, pas reconstruite.
 *
 * Le calibrage de PLAN.md §6 table sur ~10 s par question, lecture du retour
 * comprise. Répondre en moins de quatre secondes, c'est ne pas avoir eu à
 * dérouler la conjugaison — ce qui est précisément l'objectif.
 */
const FLUENT_MS = 4000

/**
 * Note d'une révision entière, à partir des 2 ou 3 questions posées.
 *
 * Une seule forme fausse suffit à faire échouer la carte : la carte porte un
 * couple `(verbe, temps)`, et le savoir à quatre personnes sur six, ce n'est pas
 * le savoir.
 */
export function rateReview(outcomes: readonly QuestionOutcome[]): Grade {
  if (outcomes.length === 0) return 'again'
  if (outcomes.some((outcome) => outcome.verdict === 'wrong')) return 'again'
  if (outcomes.some((outcome) => outcome.verdict === 'accent')) return 'hard'

  const fluent = outcomes.every((outcome) => outcome.elapsedMs <= FLUENT_MS)
  return fluent ? 'easy' : 'good'
}

/** Une carte jamais vue, à échéance immédiate. */
export function newCardState(now: Date): CardState {
  return createEmptyCard(now)
}

export interface ReviewResult {
  state: CardState
  due: Date
}

/** Applique une note à une carte et renvoie son nouvel état. */
export function applyReview(state: CardState, grade: Grade, now: Date): ReviewResult {
  const { card } = engine.next(state, now, RATINGS[grade])
  return { state: card, due: card.due }
}

/**
 * Intervalles qu'obtiendrait la carte pour chaque note, sans rien modifier.
 * Sert aux réglages et aux statistiques — jamais à décider à la place de FSRS.
 */
export function preview(state: CardState, now: Date): Record<Grade, Date> {
  const scheduled = engine.repeat(state, now)
  return {
    again: scheduled[Rating.Again].card.due,
    hard: scheduled[Rating.Hard].card.due,
    good: scheduled[Rating.Good].card.due,
    easy: scheduled[Rating.Easy].card.due,
  }
}

/** Une carte est due quand son échéance est atteinte. */
export const isDue = (state: CardState, now: Date): boolean => state.due.getTime() <= now.getTime()
