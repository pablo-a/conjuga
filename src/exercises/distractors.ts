import { PERSONS, PERSON_LABELS, TENSE_LABELS, conjugate, isCompoundTense } from '@/conjugation'
import type { Form, Person, Tense } from '@/conjugation'

/**
 * Les mauvaises réponses d'un QCM, produites par le moteur.
 *
 * C'est la pièce qui décide si un QCM enseigne ou fait perdre du temps. Un
 * distracteur tiré au hasard se rejette sans réfléchir : la question devient un
 * exercice de reconnaissance de mots espagnols, pas de conjugaison. Un
 * distracteur qui est **l'erreur qu'on fait vraiment** oblige à trancher
 * exactement là où le savoir manque.
 *
 * D'où trois sources, toutes des formes que le moteur a réellement construites :
 *
 * 1. **la forme régulière** que le verbe aurait eue s'il suivait son groupe —
 *    `penso` pour `pienso`, `tení` pour `tuve`. C'est l'erreur numéro un, et
 *    c'est celle que le moteur sait expliquer, puisqu'il calcule déjà cette
 *    référence pour localiser l'irrégularité ;
 * 2. **la bonne forme à une autre personne** — sans quoi on peut répondre en
 *    reconnaissant le verbe, sans lire la personne demandée ;
 * 3. **la même personne à un autre temps** — `hablo` contre `habló`, `pensaba`
 *    contre `pensó`. C'est la discrimination que la production ne travaille pas :
 *    au drill, on écrit ce qu'on a en tête sans jamais voir l'autre temps.
 *
 * Module pur, comme le reste de `exercises/` : le hasard lui est passé.
 */

export type DistractorKind =
  /** La forme qu'aurait le verbe s'il suivait régulièrement son groupe. */
  | 'regular'
  /** La bonne forme, mais d'une autre personne. */
  | 'person'
  /** La bonne personne, mais d'un autre temps. */
  | 'tense'

export interface Distractor {
  value: string
  kind: DistractorKind
  /** Ce que la forme est réellement, en une phrase nominale affichable. */
  label: string
  /**
   * Pourquoi le verbe s'écarte du régulier, dans les mots du moteur. Présent
   * seulement pour `regular`, et seulement si le moteur a su le dire.
   */
  reason?: string
}

export interface DistractorOptions {
  /** Combien en produire. Par défaut 3, soit un QCM à quatre propositions. */
  count?: number
  /**
   * Les temps où puiser des distracteurs de temps.
   *
   * Sans liste, on n'en produit aucun — et c'est délibéré. Le pool doit être
   * celui des temps que l'apprenant a rencontrés : lui opposer un subjonctif
   * futur qu'il n'a jamais vu rendrait la question plus facile, pas plus
   * instructive. Le module ne connaît pas le curriculum, donc il ne devine pas.
   */
  tenses?: readonly Tense[]
  random?: () => number
}

const DEFAULT_COUNT = 3

/**
 * Produit jusqu'à `count` mauvaises réponses pour une cellule donnée.
 *
 * La forme régulière passe toujours en tête quand elle existe : c'est la plus
 * instructive, et la tirer au sort reviendrait à la perdre une fois sur deux.
 * Les deux autres sources alternent, pour qu'un QCM ne propose pas trois fois la
 * même question déguisée.
 */
export function distractorsFor(
  lemma: string,
  tense: Tense,
  person: Person,
  form: Form,
  options: DistractorOptions = {},
): Distractor[] {
  const count = options.count ?? DEFAULT_COUNT
  const random = options.random ?? Math.random

  // Ce qui serait accepté à la correction ne peut pas être une mauvaise réponse.
  const accepted = new Set([form.value, ...form.alternatives])
  const taken = new Set<string>()

  const chosen: Distractor[] = []
  const full = (): boolean => chosen.length >= count
  const add = (candidate: Distractor | null): void => {
    if (candidate === null || accepted.has(candidate.value) || taken.has(candidate.value)) return
    taken.add(candidate.value)
    chosen.push(candidate)
  }

  add(regularOf(form))

  // Alternance des deux autres sources plutôt qu'épuisement de la première : un
  // QCM dont les trois erreurs sont trois personnes ne pose qu'une question.
  const pools = [
    shuffle(personDistractors(lemma, tense, person), random),
    shuffle(tenseDistractors(lemma, tense, person, options.tenses ?? []), random),
  ]
  const rounds = Math.max(0, ...pools.map((pool) => pool.length))

  for (let round = 0; round < rounds && !full(); round++) {
    for (const pool of pools) {
      if (full()) break
      add(pool[round] ?? null)
    }
  }

  return chosen.slice(0, count)
}

/**
 * La forme régulière, quand le verbe s'en écarte de façon imitable.
 *
 * `Form.regular` est calculée par le moteur avec le modèle régulier du groupe :
 * c'est exactement ce qu'un apprenant appliquant la règle produirait. Sa raison
 * vient de la première irrégularité relevée, celle que l'écran surligne.
 *
 * Sauf pour les formes **suppletives**, écartées ici : `ser` régulier donnerait
 * `ses`, que personne n'a jamais écrit pour `eres`. Une suppletion n'a aucun
 * lien avec l'infinitif, donc la règle du groupe n'a jamais été un candidat dans
 * la tête de qui que ce soit — c'est du bruit, pas une erreur plausible.
 */
function regularOf(form: Form): Distractor | null {
  if (form.regular === form.value) return null
  if (form.irregularities.some((irregularity) => irregularity.kind === 'suppletive')) return null

  const reason = form.irregularities[0]?.explanation
  return {
    value: form.regular,
    kind: 'regular',
    label: 'la forme régulière du groupe',
    ...(reason ? { reason } : {}),
  }
}

function personDistractors(lemma: string, tense: Tense, person: Person): Distractor[] {
  return PERSONS.filter((other) => other !== person).flatMap((other) => {
    const form = conjugate(lemma, tense, other)
    // Une cellule vide n'est pas une mauvaise réponse : elle n'existe pas.
    if (form === null) return []
    return [
      { value: form.value, kind: 'person' as const, label: `la forme de ${PERSON_LABELS[other]}` },
    ]
  })
}

/**
 * Le même verbe à la même personne, mais à un autre temps.
 *
 * Le pool est restreint aux temps de **même forme** : un temps composé fait deux
 * mots, un temps simple un seul, et opposer `he pensado` à `pienso` se tranche
 * en comptant les mots. Un distracteur qu'on écarte sans conjuguer ne fait que
 * rendre la question plus facile.
 */
function tenseDistractors(
  lemma: string,
  tense: Tense,
  person: Person,
  pool: readonly Tense[],
): Distractor[] {
  const compound = isCompoundTense(tense)
  return pool
    .filter((other) => other !== tense && isCompoundTense(other) === compound)
    .flatMap((other) => {
      const form = conjugate(lemma, other, person)
      if (form === null) return []
      return [{ value: form.value, kind: 'tense' as const, label: article(TENSE_LABELS[other]) }]
    })
}

/**
 * L'article défini élidé quand il le faut : « l'imparfait », pas « le imparfait ».
 *
 * Les noms des temps sont écrits dans le moteur et sortent tels quels ; la
 * poignée qui commence par une voyelle suffit à rendre la phrase fautive, et un
 * exercice qui écorche le français décrédibilise ce qu'il enseigne.
 */
function article(label: string): string {
  return /^[aeiouéèêàh]/i.test(label) ? `l’${label}` : `le ${label}`
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
