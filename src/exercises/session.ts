import { conjugate } from '@/conjugation'
import type { Form, Person, Tense } from '@/conjugation'
import { parseCardId } from '@/srs/curriculum'
import type { CardId } from '@/srs/curriculum'
import { rateReview } from '@/srs/scheduler'
import type { Grade as ReviewGrade, QuestionOutcome } from '@/srs/scheduler'
import type { Question } from '@/srs/selector'

import type { Grade } from './grading'
import { multipleChoice } from './recognition'
import type { Choice } from './recognition'

/**
 * Le déroulé d'une session, sans Vue ni persistance.
 *
 * Le sélecteur dit *quoi* poser, la correction dit *si c'est juste* ; il reste à
 * savoir sous quel format demander, quand une carte a fini d'être interrogée et
 * ce que ses réponses lui valent. C'est tout ce que fait ce module — et le garder
 * pur, c'est pouvoir vérifier la règle « une carte se note sur sa production »
 * sans monter d'interface.
 */

/** Ce qu'on demande d'une cellule : l'écrire, ou la reconnaître. */
export type ExerciseKind = 'drill' | 'choice'

/** La cellule interrogée, commune aux deux formats. */
interface Cell {
  card: CardId
  lemma: string
  tense: Tense
  person: Person
  /** La cellule attendue, avec ses variantes et ses irrégularités à surligner. */
  form: Form
}

/** Production : on tape la forme. */
export interface Drill extends Cell {
  kind: 'drill'
}

/** Reconnaissance : on désigne la forme parmi des propositions. */
export interface Recognition extends Cell {
  kind: 'choice'
  choices: readonly Choice[]
}

export type Exercise = Drill | Recognition

/** Ce qu'une question a donné. */
export interface ExerciseAnswer {
  exercise: Exercise
  grade: Grade
  /** Temps de réflexion, en millisecondes : c'est lui qui distingue `good` d'`easy`. */
  elapsedMs: number
}

/** Une carte close, prête à être rangée. */
export interface CardReview {
  card: CardId
  grade: ReviewGrade
  answers: ExerciseAnswer[]
}

export interface BuildOptions {
  /**
   * Les cartes que la session découvre.
   *
   * Elles s'ouvrent par une reconnaissance : demander d'écrire une forme qu'on
   * n'a jamais vue n'enseigne rien, ça ne fait que constater qu'on ne la sait
   * pas. Montrer d'abord, faire produire ensuite — dans la même session, sur la
   * même personne.
   */
  introducing?: ReadonlySet<CardId>
  /**
   * Les temps où puiser les distracteurs. Sans liste, le QCM s'en tient aux
   * personnes : voir `distractors.ts`, le module ignore volontairement le
   * curriculum.
   */
  tenses?: readonly Tense[]
  random?: () => number
}

/**
 * Développe les questions du sélecteur en exercices posables.
 *
 * Une cellule vide est écartée plutôt que posée. Le sélecteur ne tire en
 * principe que des personnes existantes, donc le cas ne devrait pas se
 * présenter — mais entre poser une question sans réponse et sauter une case, une
 * app qui enseigne n'a pas le choix.
 *
 * **Invariant** : une reconnaissance ne tient jamais seule sur une carte, elle
 * précède toujours la production de la même cellule. C'est ce qui permet à
 * `reviewOf` de noter sur la production sans jamais tomber sur une carte vide.
 */
export function buildExercises(
  questions: readonly Question[],
  options: BuildOptions = {},
): Exercise[] {
  const exercises: Exercise[] = []
  let opened: CardId | null = null

  for (const question of questions) {
    const { lemma, tense } = parseCardId(question.card)
    const form = conjugate(lemma, tense, question.person)
    if (form === null) continue

    const cell: Cell = { card: question.card, lemma, tense, person: question.person, form }

    if (question.card !== opened && options.introducing?.has(question.card)) {
      const qcm = multipleChoice(lemma, tense, question.person, form, {
        ...(options.tenses ? { tenses: options.tenses } : {}),
        ...(options.random ? { random: options.random } : {}),
      })
      // `null` quand le moteur ne peut pas fournir assez de leurres — un verbe
      // défectif, essentiellement. La carte s'ouvre alors directement en
      // production, ce qui vaut mieux qu'un QCM qui se joue à pile ou face.
      if (qcm !== null) exercises.push({ ...cell, kind: 'choice', choices: qcm.choices })
    }

    exercises.push({ ...cell, kind: 'drill' })
    opened = question.card
  }
  return exercises
}

/**
 * L'exercice d'indice `index` est-il le dernier de sa carte ?
 *
 * Les questions d'une même carte se suivent — `questionsFor` les produit carte
 * par carte — donc un changement de carte marque la fin de la précédente. C'est
 * ce moment qui déclenche la note FSRS et l'écriture : la progression est ainsi
 * rangée au fil de la session, et fermer l'onglet au milieu ne perd que la carte
 * en cours.
 */
export function closesCard(exercises: readonly Exercise[], index: number): boolean {
  const current = exercises[index]
  if (!current) return false
  return exercises[index + 1]?.card !== current.card
}

/**
 * Rassemble en une révision notée les réponses données sur une carte.
 *
 * La note porte sur la carte entière, jamais sur une personne : c'est le couple
 * `(verbe, temps)` qu'on prétend savoir ou non.
 *
 * Et elle porte sur la **production seule**. Reconnaître une forme parmi quatre
 * est plus facile que l'écrire : compter les deux à égalité allongerait les
 * échéances d'une carte qu'on ne sait pas encore produire, ce qui est exactement
 * la façon dont un système de répétition espacée se met à mentir. La
 * reconnaissance est un tremplin, elle n'est pas une preuve.
 */
export function reviewOf(card: CardId, answers: readonly ExerciseAnswer[]): CardReview {
  const mine = answers.filter((answer) => answer.exercise.card === card)
  const outcomes: QuestionOutcome[] = mine
    .filter((answer) => answer.exercise.kind === 'drill')
    .map((answer) => ({ verdict: answer.grade.verdict, elapsedMs: answer.elapsedMs }))

  return { card, grade: rateReview(outcomes), answers: mine }
}

/** Ce qu'une session a produit, pour le bilan de fin. */
export interface Tally {
  correct: number
  accent: number
  wrong: number
  cards: number
}

export function tally(answers: readonly ExerciseAnswer[]): Tally {
  return {
    correct: answers.filter((answer) => answer.grade.verdict === 'correct').length,
    accent: answers.filter((answer) => answer.grade.verdict === 'accent').length,
    wrong: answers.filter((answer) => answer.grade.verdict === 'wrong').length,
    cards: new Set(answers.map((answer) => answer.exercise.card)).size,
  }
}
