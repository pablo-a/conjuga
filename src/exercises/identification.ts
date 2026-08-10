import {
  PERSONS,
  PERSON_PRONOUNS,
  conjugate,
  isCompoundTense,
  stemOf,
  tenseWithArticle,
} from '@/conjugation'
import type { Person, Tense } from '@/conjugation'

/**
 * L'exercice inverse : on montre une forme, il faut dire ce que c'est.
 *
 * C'est le seul exercice de l'app qui travaille la **lecture**. Produire
 * `tuvieron` et reconnaître `tuvieron` dans une phrase sont deux compétences,
 * et la seconde est celle qu'on emploie tout le temps sans jamais l'exercer :
 * un prétérit fort ne montre pas son infinitif, et l'apprenant qui bute dessus
 * en lisant ne bute pas sur sa conjugaison, il bute sur son identification.
 *
 * D'où la règle de tirage, portée par `hidesItsInfinitive` : on ne pose la
 * question que sur les formes qui cachent leur verbe. Demander d'identifier
 * `hablaron` n'apprendrait rien à personne — l'infinitif y est écrit en toutes
 * lettres.
 *
 * Module pur : le moteur fournit les formes, le hasard est passé en paramètre.
 */

/** Une identification possible : les trois choses à nommer. */
export interface Identity {
  lemma: string
  tense: Tense
  person: Person
}

export interface IdentityOption extends Identity {
  /**
   * Clé stable de l'option, seule chose que la correction compare. Les libellés
   * sont de l'affichage ; l'identité, elle, doit survivre à leur réécriture.
   */
  value: string
  correct: boolean
  /**
   * Ce qui cloche dans cette proposition, en une phrase complète : la
   * correction l'affiche telle quelle sous l'option, et une phrase à trous s'y
   * lirait de travers.
   */
  label?: string
}

export interface Identification extends Identity {
  /** La forme montrée, celle qu'il faut identifier. */
  value: string
  options: IdentityOption[]
}

export interface IdentificationOptions {
  /** Combien de propositions en tout. Par défaut 4. */
  count?: number
  /** Les temps que l'apprenant a rencontrés, seuls candidats crédibles. */
  tenses?: readonly Tense[]
  /**
   * Les autres verbes de la session.
   *
   * Confondre deux verbes qu'on étudie en ce moment est une erreur réelle ;
   * proposer un verbe pris au hasard dans les mille n'en serait pas une. Sans
   * liste, on ne produit pas de leurre de verbe — comme pour les temps, le
   * module ne devine pas ce que l'apprenant connaît.
   */
  lemmas?: readonly string[]
  random?: () => number
}

const DEFAULT_COUNT = 4

/** En dessous, la question se joue à pile ou face : mieux vaut ne pas la poser. */
export const MIN_OPTIONS = 3

export const identityKey = (identity: Identity): string =>
  `${identity.lemma}:${identity.tense}:${identity.person}`

/**
 * Vrai quand la forme ne laisse pas deviner son infinitif.
 *
 * Le critère est direct : la forme commence-t-elle par le radical de
 * l'infinitif ? `hablaron` commence par `habl`, `tuvieron` ne commence pas par
 * `ten`. Les temps composés sont écartés d'office — le participe y suit un
 * auxiliaire qui annonce déjà le temps, et `he tenido` porte son verbe.
 */
export function hidesItsInfinitive(lemma: string, tense: Tense, form: string): boolean {
  if (isCompoundTense(tense)) return false
  const stem = stemOf(lemma)
  return stem.length > 0 && !form.startsWith(stem)
}

/**
 * Compose une question d'identification, ou renvoie `null` faute de leurres.
 *
 * Chaque mauvaise proposition ne dévie que sur **une** dimension : un temps,
 * une personne ou un verbe. C'est ce qui oblige à vérifier les trois — une
 * option fausse sur deux points se rejette sur le premier venu, et la question
 * ne porterait plus que sur lui.
 */
export function identificationOf(
  lemma: string,
  tense: Tense,
  person: Person,
  form: string,
  options: IdentificationOptions = {},
): Identification | null {
  const count = options.count ?? DEFAULT_COUNT
  const random = options.random ?? Math.random
  const truth: Identity = { lemma, tense, person }

  /*
   * Une identité qui désigne aussi la forme montrée n'est pas une mauvaise
   * réponse : c'en est une bonne. Le cas est fréquent et invisible à l'écriture
   * — `hablaba` est l'imparfait de `yo` **et** de `él`, `hablamos` est le présent
   * et le passé simple de `nosotros`. Sans ce filtre, la question aurait deux
   * réponses justes, et l'apprenant serait compté faux pour avoir eu raison.
   */
  const misidentifies = (candidate: IdentityOption): boolean =>
    conjugate(candidate.lemma, candidate.tense, candidate.person)?.value !== form

  const pools = [
    shuffle(otherTenses(truth, options.tenses ?? []).filter(misidentifies), random),
    shuffle(otherPersons(truth).filter(misidentifies), random),
    shuffle(otherLemmas(truth, options.lemmas ?? []).filter(misidentifies), random),
  ]

  const taken = new Set([identityKey(truth)])
  const wrong: IdentityOption[] = []
  const rounds = Math.max(0, ...pools.map((pool) => pool.length))

  // Alternance des trois dimensions plutôt qu'épuisement de la première : trois
  // leurres qui ne varient que la personne ne posent qu'une seule question.
  for (let round = 0; round < rounds && wrong.length < count - 1; round++) {
    for (const pool of pools) {
      if (wrong.length >= count - 1) break
      const candidate = pool[round]
      if (candidate === undefined || taken.has(candidate.value)) continue
      taken.add(candidate.value)
      wrong.push(candidate)
    }
  }

  if (wrong.length + 1 < MIN_OPTIONS) return null

  const right: IdentityOption = { ...truth, value: identityKey(truth), correct: true }
  return { ...truth, value: form, options: shuffle([right, ...wrong], random) }
}

function option(identity: Identity, label: string): IdentityOption {
  return { ...identity, value: identityKey(identity), correct: false, label }
}

function otherTenses(truth: Identity, pool: readonly Tense[]): IdentityOption[] {
  return pool
    .filter((tense) => tense !== truth.tense)
    .map((tense) =>
      option({ ...truth, tense }, `Pas le bon temps : c’est ${tenseWithArticle(truth.tense)}.`),
    )
}

function otherPersons(truth: Identity): IdentityOption[] {
  return PERSONS.filter(
    // Une personne que le verbe n'a pas ne se propose pas : la case n'existe
    // pas, donc l'option ne désigne rien.
    (person) => person !== truth.person && conjugate(truth.lemma, truth.tense, person) !== null,
  ).map((person) =>
    option({ ...truth, person }, `Pas la bonne personne : c’est ${PERSON_PRONOUNS[truth.person]}.`),
  )
}

function otherLemmas(truth: Identity, pool: readonly string[]): IdentityOption[] {
  return pool
    .filter((lemma) => lemma !== truth.lemma)
    .filter((lemma) => conjugate(lemma, truth.tense, truth.person) !== null)
    .map((lemma) => option({ ...truth, lemma }, `Pas le bon verbe : c’est ${truth.lemma}.`))
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
