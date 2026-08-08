import { conjugate } from '@/conjugation'
import type { Person } from '@/conjugation'
import { PERSONS } from '@/conjugation/types'

import { parseCardId } from './curriculum'
import type { CardId } from './curriculum'

/**
 * Composition d'une session : quelles cartes, et quelles personnes sur chacune.
 *
 * Module pur et déterministe — le hasard lui est passé en paramètre, sans quoi
 * rien de ce fichier ne serait testable.
 *
 * Le dimensionnement vient de PLAN.md §6 : 20 minutes par jour, ~10 s par
 * question, 2 à 3 personnes par carte, soit ~45 cartes dont 10 nouvelles.
 */

/** Ce que le sélecteur sait d'une carte. */
export interface DeckEntry {
  id: CardId
  /** Échéance FSRS. `null` pour une carte jamais vue. */
  due: Date | null
  /** Personnes déjà ratées sur cette carte : le tirage les favorise. */
  weakPersons?: readonly Person[]
}

export interface SessionOptions {
  /** Budget de la session. Par défaut 20 minutes. */
  budgetMs?: number
  /** Nouvelles cartes au maximum. Par défaut 10. */
  newPerSession?: number
  random?: () => number
}

/**
 * Temps moyen d'une question, réponse et lecture du retour comprises. Sert à
 * convertir un budget de minutes en nombre de cartes, jamais à interrompre
 * quelqu'un qui réfléchit.
 */
const MS_PER_QUESTION = 10_000

/** Nombre moyen de personnes posées par carte, entre 2 et 3. */
const QUESTIONS_PER_CARD = 2.5

/**
 * Au-delà de ce retard, l'introduction de nouvelles cartes s'arrête.
 *
 * C'est la spirale d'abandon classique d'Anki : on ajoute du neuf par-dessus un
 * retard qu'on ne résorbe plus, et la session devient une punition. Mieux vaut
 * une progression suspendue quelques jours qu'un tas ingérable.
 */
export const BACKLOG_PAUSE = 60

const DEFAULT_BUDGET_MS = 20 * 60 * 1000
const DEFAULT_NEW = 10

export interface SessionPlan {
  /** Les cartes à poser, dans l'ordre. */
  cards: CardId[]
  /** Combien d'entre elles sont nouvelles. */
  introduced: number
  /** Cartes en retard au moment de composer la session. */
  backlog: number
  /** Vrai quand le retard a suspendu l'introduction de nouveautés. */
  paused: boolean
}

/**
 * Compose la session du jour.
 *
 * Les révisions en retard passent d'abord, de la plus ancienne à la plus
 * récente : une carte oubliée depuis trois jours est plus urgente qu'une carte
 * due ce matin. Les nouveautés sont ensuite réparties dans le lot plutôt que
 * groupées — enchaîner dix formes inconnues d'affilée est le meilleur moyen de
 * n'en retenir aucune.
 */
export function planSession(
  deck: readonly DeckEntry[],
  unlocked: readonly CardId[],
  now: Date,
  options: SessionOptions = {},
): SessionPlan {
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS
  const newPerSession = options.newPerSession ?? DEFAULT_NEW

  const open = new Set(unlocked)
  const known = new Map(deck.map((entry) => [entry.id, entry]))

  const due = deck
    .filter(
      (entry) => open.has(entry.id) && entry.due !== null && entry.due.getTime() <= now.getTime(),
    )
    .sort((a, b) => a.due!.getTime() - b.due!.getTime())

  const backlog = due.length
  const paused = backlog > BACKLOG_PAUSE

  const capacity = Math.max(1, Math.floor(budgetMs / (QUESTIONS_PER_CARD * MS_PER_QUESTION)))

  // L'ordre du curriculum fait foi pour l'introduction : les niveaux ont été
  // rangés dans l'ordre où on veut les apprendre.
  const fresh = paused
    ? []
    : unlocked.filter((id) => !known.has(id)).slice(0, Math.min(newPerSession, capacity))

  const reviews = due.slice(0, Math.max(0, capacity - fresh.length)).map((entry) => entry.id)

  return {
    cards: interleave(reviews, fresh),
    introduced: fresh.length,
    backlog,
    paused,
  }
}

/**
 * Répartit les nouveautés dans les révisions, à intervalle régulier.
 * Quand il n'y a rien à réviser, on ne fait que les nouveautés.
 */
function interleave(reviews: readonly CardId[], fresh: readonly CardId[]): CardId[] {
  if (fresh.length === 0) return [...reviews]
  if (reviews.length === 0) return [...fresh]

  const result: CardId[] = []
  const step = reviews.length / fresh.length
  let next = 0

  for (const [index, review] of reviews.entries()) {
    while (next < fresh.length && index >= Math.floor(next * step)) {
      result.push(fresh[next]!)
      next++
    }
    result.push(review)
  }
  result.push(...fresh.slice(next))
  return result
}

/** Les personnes que ce verbe possède réellement à ce temps. */
export function availablePersons(card: CardId): Person[] {
  const { lemma, tense } = parseCardId(card)
  return PERSONS.filter((person) => {
    try {
      return conjugate(lemma, tense, person) !== null
    } catch {
      return false
    }
  })
}

/**
 * Tire les personnes à poser sur une carte : trois quand le verbe le permet,
 * moins s'il est défectif.
 *
 * Les personnes déjà ratées passent devant. Réviser en priorité ce qu'on rate
 * est tout l'intérêt d'un système de répétition : retirer au hasard reviendrait
 * à repasser surtout sur ce qu'on sait déjà.
 */
export function pickPersons(
  card: CardId,
  weak: readonly Person[] = [],
  random: () => number = Math.random,
  count = 3,
): Person[] {
  const available = availablePersons(card)
  if (available.length <= count) return available

  const weakSet = new Set(weak)
  const priority = available.filter((person) => weakSet.has(person))
  const rest = available.filter((person) => !weakSet.has(person))

  // Les faibles d'abord, mais mélangées entre elles : sur une carte ratée
  // partout, la question ne doit pas toujours tomber sur la même personne.
  return [...shuffle(priority, random), ...shuffle(rest, random)].slice(0, count)
}

/** Mélange de Fisher-Yates, sur une copie. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap]!, copy[index]!]
  }
  return copy
}

/** Une question posée pendant la session. */
export interface Question {
  card: CardId
  person: Person
}

/** Développe un plan de session en questions, carte par carte. */
export function questionsFor(
  plan: SessionPlan,
  deck: readonly DeckEntry[],
  random: () => number = Math.random,
): Question[] {
  const weakByCard = new Map(deck.map((entry) => [entry.id, entry.weakPersons ?? []]))
  return plan.cards.flatMap((card) =>
    pickPersons(card, weakByCard.get(card), random).map((person) => ({ card, person })),
  )
}
