import { conjugate } from '@/conjugation'
import type { Person, Tense } from '@/conjugation'
import { PERSONS } from '@/conjugation/types'

import { parseCardId } from './curriculum'
import type { CardId } from './curriculum'
import { dayKey } from './streak'

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
  /**
   * Dernière révision. `null` pour une carte jamais vue.
   *
   * Sert à reconnaître une **repasse** : FSRS ramène une carte neuve dans les dix
   * minutes, et cette seconde vue n'est pas un deuxième travail à faire, c'est la
   * fin du premier. Sans cette distinction, l'objectif du jour grossirait à
   * chaque carte découverte.
   */
  lastReview?: Date | null
  /** Personnes déjà ratées sur cette carte : le tirage les favorise. */
  weakPersons?: readonly Person[]
}

/**
 * Ce que la journée a déjà consommé, tel que la table `days` le compte.
 *
 * Sans lui, le budget serait celui d'une *session* : deux sessions dans la même
 * journée en donneraient deux pleines, avec dix nouvelles cartes chacune, et la
 * journée n'aurait pas de fin — c'est ce qui faisait qu'un décompte annoncé sur
 * l'accueil ne bougeait pas quoi qu'on révise.
 */
export interface DayProgress {
  /**
   * Cartes **distinctes** du programme déjà révisées : dues ou nouvelles. Une
   * carte repassée dans la journée n'y compte qu'une fois — c'est ce qui rend
   * l'objectif stable.
   */
  planned: number
  /** Nouveautés déjà découvertes. */
  introduced: number
}

export interface SessionOptions {
  /** Budget de la journée. Par défaut 20 minutes, ou 5 pour une session ciblée. */
  budgetMs?: number
  /** Nouvelles cartes au maximum, pour la journée entière. Par défaut 10. */
  newPerSession?: number
  /** Ce qui a déjà été fait aujourd'hui, et qui se déduit du budget. */
  today?: DayProgress
  /**
   * Restreint la session à ces temps — c'est le drill lancé depuis une fiche de
   * théorie. Une liste plutôt qu'un temps unique parce qu'une fiche en couvre
   * parfois deux, et que « indefinido ou imperfecto » ne s'exerce justement
   * qu'en les mêlant.
   */
  focus?: readonly Tense[]
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

/**
 * Budget d'une session ciblée.
 *
 * On ne referme pas une fiche de théorie pour repartir vingt minutes : le drill
 * ciblé est un essai immédiat, et le budget quotidien doit rester disponible
 * pour la session ordinaire, qui seule suit l'ordre du programme.
 */
export const FOCUS_BUDGET_MS = 5 * 60 * 1000

export interface SessionPlan {
  /** Les cartes à poser, dans l'ordre. */
  cards: CardId[]
  /**
   * Le travail de la journée entière : ce qui a déjà été fait, plus ce que cette
   * session pose de neuf. C'est le dénominateur du « 12 / 48 » de l'accueil, et
   * il est calculé ici parce qu'il doit rester **stable** d'un bout à l'autre du
   * jour — ce qu'on retire du reste, on l'a ajouté au fait.
   *
   * Deux sortes de cartes n'y entrent pas : celles révisées en avance, qui ne
   * font partie d'aucun programme, et les repasses, qui achèvent un travail déjà
   * compté. Les unes comme les autres feraient grossir un objectif qu'on croyait
   * atteindre.
   */
  goal: number
  /**
   * Cartes déjà vues aujourd'hui que FSRS ramène avant ce soir — la seconde vue
   * d'une nouveauté, ou la reprise d'une carte ratée.
   *
   * Elles sont posées **en plus** du budget, jamais à la place : les écarter
   * faute de place reviendrait à rétablir les pas d'apprentissage puis à ne
   * jamais les honorer, et la carte resterait due jusqu'au lendemain.
   */
  repeats: number
  /**
   * Cartes vues aujourd'hui dont la repasse n'est **pas encore** due, mais le
   * sera avant ce soir.
   *
   * Sans ce compte, l'accueil annoncerait « séance terminée » à quelqu'un dont
   * dix cartes vont reparaître dans dix minutes. L'app dit ailleurs qu'une case
   * vide s'annonce plutôt qu'elle ne se laisse deviner ; c'est la même règle.
   */
  pending: number
  /**
   * Celles que la session découvre. La composition des exercices en a besoin, et
   * pas seulement de leur nombre : une carte jamais vue s'ouvre par une
   * reconnaissance, où l'on montre la forme avant de demander de l'écrire.
   */
  fresh: readonly CardId[]
  /** Combien d'entre elles sont nouvelles. */
  introduced: number
  /**
   * Combien sont révisées en avance sur leur échéance. Toujours 0 hors session
   * ciblée. `cards.length - introduced - ahead` donne les révisions dues.
   */
  ahead: number
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
 *
 * Le budget est celui de la **journée**, pas d'une session : `today` en retranche
 * ce qui a déjà été révisé, cartes du programme comme nouveautés. C'est ce qui
 * permet à une journée de se terminer — sans quoi revenir sur l'accueil après
 * une séance recomposerait une séance entière, dix nouveautés comprises.
 *
 * Les **repasses** échappent à ce budget : une carte déjà vue aujourd'hui que
 * FSRS ramène avant ce soir passe en tête, hors quota. C'est la contrepartie des
 * pas d'apprentissage — les rétablir puis les refuser faute de place laisserait
 * la carte due jusqu'au lendemain, ce qui est le pire des deux mondes.
 *
 * `focus` restreint le tout à quelques temps, et change une règle : les cartes
 * pas encore échues deviennent acceptables. Un apprenant qui vient de lire une
 * fiche veut l'essayer maintenant, et lui répondre « rien à réviser » ferait du
 * lien une impasse. Elles ne viennent qu'après les cartes réellement dues, et
 * jamais dans une session ordinaire, où elles videraient la répétition espacée
 * de son seul intérêt. Une session ciblée garde son propre budget entier — c'est
 * un supplément, pas une part du quotidien — mais son plafond de nouveautés est
 * bien celui du jour : une carte neuve reste une carte neuve.
 */
export function planSession(
  deck: readonly DeckEntry[],
  unlocked: readonly CardId[],
  now: Date,
  options: SessionOptions = {},
): SessionPlan {
  const focus = options.focus
  const budgetMs = options.budgetMs ?? (focus ? FOCUS_BUDGET_MS : DEFAULT_BUDGET_MS)
  const done = options.today ?? { planned: 0, introduced: 0 }

  const wanted = focus === undefined ? undefined : new Set<string>(focus)
  const candidates =
    wanted === undefined ? unlocked : unlocked.filter((id) => wanted.has(parseCardId(id).tense))

  const open = new Set(candidates)
  const known = new Map(deck.map((entry) => [entry.id, entry]))

  const scheduled = deck.filter((entry) => open.has(entry.id) && entry.due !== null)
  const ripe = scheduled
    .filter((entry) => entry.due!.getTime() <= now.getTime())
    .sort((a, b) => a.due!.getTime() - b.due!.getTime())

  /*
   * Ce qui a déjà été vu aujourd'hui et revient avant ce soir : la seconde vue
   * d'une nouveauté, ou la reprise d'une carte ratée. C'est du travail déjà
   * compté au programme, qu'on achève — pas du travail en plus.
   */
  const today = dayKey(now)
  const seenToday = (entry: DeckEntry): boolean =>
    entry.lastReview != null && dayKey(entry.lastReview) === today

  const repeats = ripe.filter(seenToday).map((entry) => entry.id)
  const due = ripe.filter((entry) => !seenToday(entry))

  // Les repasses encore à venir : dues plus tard, mais avant ce soir.
  const pending = scheduled.filter(
    (entry) =>
      seenToday(entry) && entry.due!.getTime() > now.getTime() && dayKey(entry.due!) === today,
  ).length

  // Le retard ne compte que ce qui reste à faire : une carte qu'on vient de voir
  // n'est pas en retard, et la compter ferait paraître un rattrapage sur place.
  const backlog = due.length
  const paused = backlog > BACKLOG_PAUSE

  const daily = Math.max(1, Math.floor(budgetMs / (QUESTIONS_PER_CARD * MS_PER_QUESTION)))

  // Une session ciblée ne puise pas dans le budget quotidien : elle a le sien,
  // court, et ce qu'elle révise en avance ne compte de toute façon pas comme
  // travail du jour.
  const capacity = focus === undefined ? Math.max(0, daily - done.planned) : daily
  const newToday = Math.max(0, (options.newPerSession ?? DEFAULT_NEW) - done.introduced)

  // L'ordre du curriculum fait foi pour l'introduction : les niveaux ont été
  // rangés dans l'ordre où on veut les apprendre.
  const fresh = paused
    ? []
    : candidates.filter((id) => !known.has(id)).slice(0, Math.min(newToday, capacity))

  const reviews = due.slice(0, Math.max(0, capacity - fresh.length)).map((entry) => entry.id)

  // Les plus proches de leur échéance d'abord : ce sont celles dont l'oubli
  // approche, donc celles que réviser en avance coûte le moins.
  const early =
    focus === undefined
      ? []
      : scheduled
          .filter((entry) => entry.due!.getTime() > now.getTime())
          .sort((a, b) => a.due!.getTime() - b.due!.getTime())
          .slice(0, Math.max(0, capacity - fresh.length - reviews.length))
          .map((entry) => entry.id)

  return {
    // Les repasses en tête : ce sont des cartes vues il y a quelques minutes, et
    // c'est justement leur fraîcheur qui fait qu'on les repose maintenant.
    cards: [...repeats, ...interleave([...reviews, ...early], fresh)],
    goal: done.planned + reviews.length + fresh.length,
    repeats: repeats.length,
    pending,
    fresh,
    introduced: fresh.length,
    ahead: early.length,
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
