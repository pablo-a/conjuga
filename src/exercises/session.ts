import { conjugate } from '@/conjugation'
import type { Form, Person, Tense } from '@/conjugation'
import { parseCardId } from '@/srs/curriculum'
import type { CardId } from '@/srs/curriculum'
import { rateReview } from '@/srs/scheduler'
import type { Grade as ReviewGrade, QuestionOutcome } from '@/srs/scheduler'
import type { Question } from '@/srs/selector'

import type { Grade } from './grading'
import { hidesItsInfinitive, identificationOf } from './identification'
import type { IdentityOption } from './identification'
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

/** Ce qu'on demande d'une cellule : l'écrire, la reconnaître, ou la nommer. */
export type ExerciseKind = 'drill' | 'choice' | 'identify'

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

/** Identification : on montre la forme, il faut dire verbe, temps et personne. */
export interface Identify extends Cell {
  kind: 'identify'
  options: readonly IdentityOption[]
  /** La clé de la bonne identité, contre laquelle la réponse est comparée. */
  expected: string
}

export type Exercise = Drill | Recognition | Identify

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
  /**
   * Les autres verbes de la session, pour les leurres de l'exercice inverse.
   * Confondre deux verbes qu'on étudie est une erreur réelle ; en proposer un
   * pris au hasard dans les mille n'en serait pas une.
   */
  lemmas?: readonly string[]
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
 * **Invariant** : ni reconnaissance ni identification ne tiennent seules sur une
 * carte, elles encadrent toujours au moins une production. C'est ce qui permet à
 * `reviewOf` de noter sur la production sans jamais tomber sur une carte vide.
 *
 * Une carte neuve s'ouvre donc par une reconnaissance ; une carte déjà connue se
 * **ferme** par une identification, quand sa forme cache son infinitif. L'ordre
 * n'est pas indifférent : on montre avant de faire écrire, et on ne fait nommer
 * qu'après avoir fait écrire.
 */
export function buildExercises(
  questions: readonly Question[],
  options: BuildOptions = {},
): Exercise[] {
  const exercises: Exercise[] = []
  const random = options.random ?? Math.random

  for (const group of byCard(questions)) {
    const cells = group.flatMap(toCell)
    const first = cells[0]
    if (first === undefined) continue

    const fresh = options.introducing?.has(first.card) === true

    if (fresh) {
      const qcm = multipleChoice(first.lemma, first.tense, first.person, first.form, {
        ...(options.tenses ? { tenses: options.tenses } : {}),
        random,
      })
      // `null` quand le moteur ne peut pas fournir assez de leurres — un verbe
      // défectif, essentiellement. La carte s'ouvre alors directement en
      // production, ce qui vaut mieux qu'un QCM qui se joue à pile ou face.
      if (qcm !== null) exercises.push({ ...first, kind: 'choice', choices: qcm.choices })
    }

    for (const cell of cells) exercises.push({ ...cell, kind: 'drill' })

    if (!fresh) {
      const identify = closingIdentification(cells, options, random)
      if (identify !== null) exercises.push(identify)
    }
  }
  return exercises
}

/**
 * L'identification qui clôt une carte, s'il y a lieu.
 *
 * On ne la pose que sur une forme qui **cache son infinitif** : demander à quel
 * verbe appartient `hablaron` n'apprendrait rien, il est écrit dedans. Et on
 * ne la pose pas sur une carte neuve — nommer une forme rencontrée deux minutes
 * plus tôt teste la mémoire de la session, pas la lecture de l'espagnol.
 */
function closingIdentification(
  cells: readonly Cell[],
  options: BuildOptions,
  random: () => number,
): Identify | null {
  const cell = cells.find((candidate) =>
    hidesItsInfinitive(candidate.lemma, candidate.tense, candidate.form.value),
  )
  if (cell === undefined) return null

  const question = identificationOf(cell.lemma, cell.tense, cell.person, cell.form.value, {
    ...(options.tenses ? { tenses: options.tenses } : {}),
    ...(options.lemmas ? { lemmas: options.lemmas } : {}),
    random,
  })
  if (question === null) return null

  const expected = question.options.find((option) => option.correct)!.value
  return { ...cell, kind: 'identify', options: question.options, expected }
}

/** Les questions regroupées par carte, dans l'ordre où le sélecteur les a produites. */
function byCard(questions: readonly Question[]): Question[][] {
  const groups: Question[][] = []
  for (const question of questions) {
    const last = groups[groups.length - 1]
    if (last !== undefined && last[0]!.card === question.card) last.push(question)
    else groups.push([question])
  }
  return groups
}

/** Une cellule posable, ou rien si elle n'existe pas. */
function toCell(question: Question): Cell[] {
  const { lemma, tense } = parseCardId(question.card)
  const form = conjugate(lemma, tense, question.person)
  if (form === null) return []
  return [{ card: question.card, lemma, tense, person: question.person, form }]
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
