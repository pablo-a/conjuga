import type { Form, Person, Tense } from '@/conjugation'

import { distractorsFor } from './distractors'
import type { DistractorOptions } from './distractors'

/**
 * L'exercice de reconnaissance : on montre des formes, l'apprenant désigne la
 * bonne.
 *
 * C'est le complément du drill, pas son remplaçant. Produire une forme et la
 * reconnaître ne sollicitent pas la même chose : au drill on écrit ce qu'on a en
 * tête sans jamais voir l'autre temps, et c'est précisément la confusion entre
 * deux formes voisines qui reste invisible. Le QCM la met sous les yeux.
 *
 * Toute la valeur est dans `distractors.ts` ; ce module ne fait qu'assembler et
 * mélanger. Il n'a pas de fonction de correction : une proposition porte déjà
 * `correct`. C'est une différence de fond avec le drill — désigner une forme
 * fausse est une erreur pleine, là où l'écrire à un accent près est un
 * quasi-succès. On ne choisit pas un accent par mégarde.
 */

export interface Choice {
  value: string
  correct: boolean
  /** Ce que la forme est réellement, pour la correction. Absent sur la bonne réponse. */
  label?: string
  /** Pourquoi le verbe s'écarte du régulier, quand c'est ce que la proposition montrait. */
  reason?: string
}

export interface MultipleChoice {
  lemma: string
  tense: Tense
  person: Person
  form: Form
  /** Les propositions, mélangées. La bonne est à une place quelconque. */
  choices: Choice[]
}

/**
 * En dessous de ce nombre de propositions, on ne pose pas la question.
 *
 * À deux propositions, répondre au hasard réussit une fois sur deux : le
 * résultat ne mesure plus rien, et une carte peut être repoussée sur un coup de
 * pièce. Les verbes défectifs sont les seuls concernés — `llover` n'a qu'une
 * personne, donc peu de leurres possibles. Mieux vaut leur poser un drill.
 */
export const MIN_CHOICES = 3

/**
 * Compose un QCM sur une cellule, ou renvoie `null` si le moteur ne peut pas
 * fournir assez de mauvaises réponses pour que la question ait un sens.
 */
export function multipleChoice(
  lemma: string,
  tense: Tense,
  person: Person,
  form: Form,
  options: DistractorOptions = {},
): MultipleChoice | null {
  const random = options.random ?? Math.random
  const distractors = distractorsFor(lemma, tense, person, form, options)

  if (distractors.length + 1 < MIN_CHOICES) return null

  const choices: Choice[] = [
    { value: form.value, correct: true },
    ...distractors.map((distractor) => ({
      value: distractor.value,
      correct: false,
      label: distractor.label,
      ...(distractor.reason ? { reason: distractor.reason } : {}),
    })),
  ]

  return { lemma, tense, person, form, choices: shuffle(choices, random) }
}

/**
 * Mélange de Fisher-Yates, sur une copie.
 *
 * Il porte sur **toutes** les propositions, bonne réponse comprise : la placer
 * ailleurs qu'en tête ne suffirait pas, il faut que sa position soit uniforme.
 * Une bonne réponse qui tombe rarement en première ligne s'apprend aussi vite
 * que la conjugaison elle-même.
 */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap]!, copy[index]!]
  }
  return copy
}
