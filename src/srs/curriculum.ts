import lemmas from '@/data/lemmas.json'
import type { Tense } from '@/conjugation'
import { conjugate } from '@/conjugation'
import { PERSONS } from '@/conjugation/types'

/**
 * Déblocage progressif : quelles cartes existent, et dans quel ordre.
 *
 * Une **carte** est un couple `(lemma, tense)`. 1000 verbes × 8 temps du scope A2
 * feraient 8000 cartes ; les débloquer toutes d'un coup reviendrait à noyer
 * l'apprenant et à saborder l'ordonnancement. Les niveaux les libèrent par
 * paquets cohérents, chacun conditionné à la maîtrise du précédent (PLAN.md §6).
 *
 * Module pur : il décrit le programme, il ne sait rien de la progression réelle,
 * qu'on lui passe.
 */

export type CardId = string

/** Identifiant stable d'une carte. Sert de clé primaire dans IndexedDB. */
export const cardId = (lemma: string, tense: Tense): CardId => `${lemma}:${tense}`

export function parseCardId(id: CardId): { lemma: string; tense: Tense } {
  const separator = id.indexOf(':')
  return { lemma: id.slice(0, separator), tense: id.slice(separator + 1) as Tense }
}

/**
 * Les `count` verbes les plus fréquents, dans l'ordre du classement.
 *
 * `lemmas.json` ne porte que les infinitifs, quand `verbs.json` porte aussi les
 * gloses : le curriculum n'a besoin que de l'ordre, et embarquer 110 Ko de
 * définitions non relues pour en tirer un classement serait payer cher un
 * contenu qu'on ne veut pas encore afficher.
 */
const topVerbs = (count: number): string[] => lemmas.slice(0, count)

/**
 * Les temps du scope A2, dans l'ordre où le curriculum les introduit.
 * Le subjonctif n'en fait pas partie : il clôt le programme (niveau 9).
 */
export const A2_TENSES: readonly Tense[] = [
  'indicativo.presente',
  'indicativo.perfecto',
  'indicativo.indefinido',
  'indicativo.imperfecto',
  'indicativo.futuro',
  'indicativo.condicional',
]

export interface Level {
  id: string
  name: string
  /** Ce que le niveau apprend, en une phrase affichable. */
  goal: string
  cards: readonly CardId[]
}

/**
 * Une carte n'a de sens que si le verbe possède réellement le temps : `soler` n'a
 * pas de futur, `llover` pas de première personne. Le moteur le sait, et une
 * carte vide serait une question sans réponse.
 */
function exists(lemma: string, tense: Tense): boolean {
  return PERSONS.some((person) => {
    try {
      return conjugate(lemma, tense, person) !== null
    } catch {
      return false
    }
  })
}

function build(lemmas: readonly string[], tenses: readonly Tense[]): CardId[] {
  const cards: CardId[] = []
  for (const tense of tenses) {
    for (const lemma of lemmas) {
      if (exists(lemma, tense)) cards.push(cardId(lemma, tense))
    }
  }
  return cards
}

/**
 * Les quatre verbes sans lesquels aucune phrase espagnole ne tient debout. Ils
 * méritent tous les temps dès le deuxième niveau, alors que le reste du
 * vocabulaire n'en verra qu'un à la fois.
 */
const ESSENTIALS = ['ser', 'estar', 'ir', 'haber']

const levels: Level[] = [
  {
    id: 'presente-50',
    name: 'Le présent',
    goal: 'Les 50 verbes les plus fréquents au présent de l’indicatif.',
    cards: build(topVerbs(50), ['indicativo.presente']),
  },
  {
    id: 'essentiels',
    name: 'Les quatre piliers',
    goal: 'ser, estar, ir et haber à tous les temps de l’indicatif.',
    cards: build(ESSENTIALS, A2_TENSES),
  },
  {
    id: 'perfecto',
    name: 'Le passé composé',
    goal: 'Le pretérito perfecto — haber au présent, plus le participe.',
    cards: build(topVerbs(100), ['indicativo.perfecto']),
  },
  {
    id: 'indefinido',
    name: 'Le passé simple',
    goal: 'Le pretérito indefinido, et ses prétérits forts.',
    cards: build(topVerbs(100), ['indicativo.indefinido']),
  },
  {
    id: 'imperfecto',
    name: 'L’imparfait',
    goal: 'L’imperfecto, le temps le plus régulier de l’espagnol.',
    cards: build(topVerbs(100), ['indicativo.imperfecto']),
  },
  {
    /*
     * Le piège numéro un du francophone : la ligne de partage entre `indefinido`
     * et `imperfecto` n'est pas celle du passé simple et de l'imparfait français.
     * Ce niveau ne débloque aucune carte nouvelle — il remet les deux temps en
     * circulation *ensemble*, ce qui oblige à les tenir distincts au lieu de les
     * réviser chacun dans son couloir.
     */
    id: 'pasado-mixto',
    name: 'Indefinido ou imperfecto',
    goal: 'Les deux passés mêlés, pour cesser de les confondre.',
    cards: build(topVerbs(100), ['indicativo.indefinido', 'indicativo.imperfecto']),
  },
  {
    id: 'futuro',
    name: 'Futur et conditionnel',
    goal: 'Les deux temps bâtis sur l’infinitif, et leurs radicaux syncopés.',
    cards: build(topVerbs(100), ['indicativo.futuro', 'indicativo.condicional']),
  },
  {
    id: 'imperativo',
    name: 'L’impératif',
    goal: 'Ordonner et défendre — deux paradigmes pour un seul mode.',
    cards: build(topVerbs(50), ['imperativo.afirmativo', 'imperativo.negativo']),
  },
  {
    id: 'subjuntivo',
    name: 'Le subjonctif',
    goal: 'Le présent du subjonctif, vivant en espagnol là où le français l’a perdu.',
    cards: build(topVerbs(50), ['subjuntivo.presente']),
  },
]

export const LEVELS: readonly Level[] = levels

/**
 * Stabilité à partir de laquelle une carte est tenue pour acquise.
 *
 * C'est l'estimation FSRS du délai au bout duquel le souvenir reste accessible :
 * au-delà d'une semaine, la forme n'est plus reconstruite à chaque fois, elle est
 * sue. Le seuil est volontairement modeste — il ouvre le niveau suivant, il ne
 * décerne pas un diplôme.
 */
export const MASTERY_STABILITY_DAYS = 7

/** Part du niveau à maîtriser pour débloquer le suivant. PLAN.md §6. */
export const MASTERY_RATIO = 0.8

/** Ce que l'appelant sait de la progression : stabilité atteinte par carte. */
export type Progress = ReadonlyMap<CardId, number>

/** Part des cartes d'un niveau qui sont acquises, entre 0 et 1. */
export function mastery(level: Level, progress: Progress): number {
  if (level.cards.length === 0) return 1
  const known = level.cards.filter(
    (card) => (progress.get(card) ?? 0) >= MASTERY_STABILITY_DAYS,
  ).length
  return known / level.cards.length
}

/**
 * Les niveaux ouverts, dans l'ordre.
 *
 * Le premier l'est toujours — il faut bien commencer — et chaque suivant s'ouvre
 * quand le précédent atteint le seuil. On s'arrête au premier niveau non acquis :
 * un trou dans la progression ne doit pas laisser passer les niveaux d'après.
 */
export function unlockedLevels(progress: Progress): Level[] {
  const open: Level[] = []
  for (const level of levels) {
    open.push(level)
    if (mastery(level, progress) < MASTERY_RATIO) break
  }
  return open
}

/** Toutes les cartes actuellement ouvertes, sans doublon et dans l'ordre du programme. */
export function unlockedCards(progress: Progress): CardId[] {
  return [...new Set(unlockedLevels(progress).flatMap((level) => level.cards))]
}

/** Le niveau en cours : le dernier ouvert. */
export function currentLevel(progress: Progress): Level {
  const open = unlockedLevels(progress)
  return open[open.length - 1]!
}
