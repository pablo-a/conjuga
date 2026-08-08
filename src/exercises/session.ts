import { conjugate } from '@/conjugation'
import type { Form, Person, Tense } from '@/conjugation'
import { parseCardId } from '@/srs/curriculum'
import type { CardId } from '@/srs/curriculum'
import { rateReview } from '@/srs/scheduler'
import type { Grade as ReviewGrade, QuestionOutcome } from '@/srs/scheduler'
import type { Question } from '@/srs/selector'

import type { Grade } from './grading'

/**
 * Le déroulé d'une session, sans Vue ni persistance.
 *
 * Le sélecteur dit *quoi* poser, la correction dit *si c'est juste* ; il reste à
 * savoir quand une carte a fini d'être interrogée et ce que ses réponses lui
 * valent. C'est tout ce que fait ce module — et le garder pur, c'est pouvoir
 * vérifier la règle « une carte se note sur l'ensemble de ses personnes » sans
 * monter d'interface.
 */

/** Une question posée : la cellule à produire, et de quoi l'énoncer. */
export interface Drill {
  card: CardId
  lemma: string
  tense: Tense
  person: Person
  /** La cellule attendue, avec ses variantes et ses irrégularités à surligner. */
  form: Form
}

/** Ce qu'une question a donné. */
export interface DrillAnswer {
  drill: Drill
  grade: Grade
  /** Temps de réflexion, en millisecondes : c'est lui qui distingue `good` d'`easy`. */
  elapsedMs: number
}

/** Une carte close, prête à être rangée. */
export interface CardReview {
  card: CardId
  grade: ReviewGrade
  answers: DrillAnswer[]
}

/**
 * Développe les questions du sélecteur en questions posables.
 *
 * Une cellule vide est écartée plutôt que posée. Le sélecteur ne tire en
 * principe que des personnes existantes, donc le cas ne devrait pas se
 * présenter — mais entre poser une question sans réponse et sauter une case, une
 * app qui enseigne n'a pas le choix.
 */
export function buildDrills(questions: readonly Question[]): Drill[] {
  const drills: Drill[] = []

  for (const question of questions) {
    const { lemma, tense } = parseCardId(question.card)
    const form = conjugate(lemma, tense, question.person)
    if (form === null) continue
    drills.push({ card: question.card, lemma, tense, person: question.person, form })
  }
  return drills
}

/**
 * La question d'indice `index` est-elle la dernière de sa carte ?
 *
 * Les questions d'une même carte se suivent — `questionsFor` les produit carte
 * par carte — donc un changement de carte marque la fin de la précédente. C'est
 * ce moment qui déclenche la note FSRS et l'écriture : la progression est ainsi
 * rangée au fil de la session, et fermer l'onglet au milieu ne perd que la carte
 * en cours.
 */
export function closesCard(drills: readonly Drill[], index: number): boolean {
  const current = drills[index]
  if (!current) return false
  return drills[index + 1]?.card !== current.card
}

/**
 * Rassemble en une révision notée les réponses données sur une carte.
 *
 * La note porte sur la carte entière, jamais sur une personne : c'est le couple
 * `(verbe, temps)` qu'on prétend savoir ou non.
 */
export function reviewOf(card: CardId, answers: readonly DrillAnswer[]): CardReview {
  const mine = answers.filter((answer) => answer.drill.card === card)
  const outcomes: QuestionOutcome[] = mine.map((answer) => ({
    verdict: answer.grade.verdict,
    elapsedMs: answer.elapsedMs,
  }))
  return { card, grade: rateReview(outcomes), answers: mine }
}

/** Ce qu'une session a produit, pour le bilan de fin. */
export interface Tally {
  correct: number
  accent: number
  wrong: number
  cards: number
}

export function tally(answers: readonly DrillAnswer[]): Tally {
  return {
    correct: answers.filter((answer) => answer.grade.verdict === 'correct').length,
    accent: answers.filter((answer) => answer.grade.verdict === 'accent').length,
    wrong: answers.filter((answer) => answer.grade.verdict === 'wrong').length,
    cards: new Set(answers.map((answer) => answer.drill.card)).size,
  }
}
