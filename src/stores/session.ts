import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { Tense } from '@/conjugation'
import { loadSnapshot, saveReview, weakPersons } from '@/db/repository'
import { grade as correct, gradeSelection } from '@/exercises/grading'
import { buildExercises, closesCard, reviewOf, tally } from '@/exercises/session'
import type { Exercise, ExerciseAnswer } from '@/exercises/session'
import { A2_TENSES, currentLevel, unlockedCards } from '@/srs/curriculum'
import type { CardId, Level } from '@/srs/curriculum'
import { planSession, questionsFor } from '@/srs/selector'
import type { DeckEntry, SessionPlan } from '@/srs/selector'

/**
 * La session du jour : le seul endroit où le curriculum, le sélecteur, la
 * correction et la persistance se rencontrent.
 *
 * Tout ce qui est décidable sans état vit dans les modules purs qu'il appelle —
 * ce fichier ne fait qu'enchaîner, mesurer le temps de réflexion et ranger. Si
 * une règle d'apprentissage se retrouve écrite ici, c'est qu'elle est au mauvais
 * endroit.
 */

export type SessionStatus =
  /** Rien n'a encore été demandé. */
  | 'idle'
  /** Lecture d'IndexedDB et composition de la session. */
  | 'loading'
  /** Une question est posée. */
  | 'running'
  /** Session terminée — ou vide, s'il n'y avait rien à réviser. */
  | 'done'
  /** La persistance est indisponible : navigation privée, quota, base verrouillée. */
  | 'error'

/** De quoi composer une session : tout est optionnel, tout a un défaut. */
export interface StartOptions {
  now?: Date
  random?: () => number
  /** Restreint la session à ces temps — le drill lancé depuis une fiche. */
  focus?: readonly Tense[]
}

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('idle')
  const error = ref<string | null>(null)

  // Les formes conjuguées sont figées à la composition de la session : les rendre
  // profondément réactives ferait observer chaque caractère de chaque forme.
  const exercises = shallowRef<Exercise[]>([])
  const answers = shallowRef<ExerciseAnswer[]>([])
  const index = ref(0)

  const plan = shallowRef<SessionPlan | null>(null)
  const level = shallowRef<Level | null>(null)

  /** Les temps auxquels la session est restreinte, quand elle l'est. */
  const focus = shallowRef<readonly Tense[] | null>(null)

  /**
   * Instant d'affichage de la question courante. Volontairement hors de l'état
   * réactif : rien ne l'affiche, et le lire déclencherait des rendus à chaque
   * frappe pour une valeur qui ne sert qu'au moment de valider.
   */
  let shownAt = 0

  const current = computed<Exercise | null>(() => exercises.value[index.value] ?? null)

  /**
   * La réponse à la question courante, si elle a déjà été donnée.
   *
   * Les réponses sont empilées dans l'ordre des questions et on n'avance jamais
   * sans avoir répondu : la réponse d'indice `index` est donc celle de la
   * question affichée, et son existence distingue « en train de répondre » de
   * « en train de lire la correction ».
   */
  const answered = computed<ExerciseAnswer | null>(() => answers.value[index.value] ?? null)

  const total = computed(() => exercises.value.length)
  const completed = computed(() => answers.value.length)
  const summary = computed(() => tally(answers.value))

  /** Session terminée sans avoir rien eu à poser : tout est à jour. */
  const empty = computed(() => status.value === 'done' && total.value === 0)

  /**
   * Compose la session du jour.
   *
   * L'ordre est imposé : la progression détermine les niveaux ouverts, les
   * niveaux ouverts déterminent les cartes candidates, et seules les cartes
   * retenues valent la peine qu'on aille chercher leurs personnes faibles.
   */
  async function start(options: StartOptions = {}): Promise<void> {
    const now = options.now ?? new Date()
    const random = options.random ?? Math.random

    status.value = 'loading'
    error.value = null
    focus.value = options.focus ?? null

    try {
      const { deck, progress } = await loadSnapshot()
      const session = planSession(deck, unlockedCards(progress), now, {
        random,
        ...(options.focus ? { focus: options.focus } : {}),
      })
      const weak = await weakPersons(session.cards)

      const known = new Map(deck.map((entry) => [entry.id, entry]))
      const weighted: DeckEntry[] = session.cards.map((id) => ({
        id,
        due: known.get(id)?.due ?? null,
        weakPersons: weak.get(id) ?? [],
      }))

      level.value = currentLevel(progress)
      plan.value = session
      exercises.value = buildExercises(questionsFor(session, weighted, random), {
        introducing: new Set(session.fresh),
        tenses: options.focus ?? A2_TENSES,
        random,
      })
      answers.value = []
      index.value = 0
      shownAt = Date.now()
      status.value = exercises.value.length > 0 ? 'running' : 'done'
    } catch (cause) {
      // Sans IndexedDB, il n'y a pas de session : proposer des questions dont le
      // résultat serait jeté ferait croire à une progression qui n'existe pas.
      error.value = cause instanceof Error ? cause.message : String(cause)
      status.value = 'error'
    }
  }

  /**
   * Corrige la réponse et, si elle clôt la carte, range la révision.
   *
   * L'écriture a lieu carte par carte plutôt qu'en fin de session : une session
   * de vingt minutes interrompue par un appel ou un onglet fermé ne doit pas
   * effacer ce qui a été révisé.
   */
  async function submit(text: string): Promise<void> {
    const exercise = current.value
    if (status.value !== 'running' || exercise === null || answered.value !== null) return

    // Le format décide de la correction, et c'est la seule chose que le magasin
    // ait à en savoir : la tolérance sur l'accent n'a de sens que pour ce qui est
    // tapé (voir `gradeSelection`).
    const grade = exercise.kind === 'drill' ? correct : gradeSelection

    const answer: ExerciseAnswer = {
      exercise,
      grade: grade(text, exercise.form),
      elapsedMs: Math.max(0, Date.now() - shownAt),
    }
    answers.value = [...answers.value, answer]

    if (closesCard(exercises.value, index.value)) await persist(exercise.card)
  }

  async function persist(card: CardId): Promise<void> {
    const review = reviewOf(card, answers.value)
    try {
      await saveReview({
        card,
        grade: review.grade,
        at: new Date(),
        answers: review.answers.map((answer) => ({
          person: answer.exercise.person,
          kind: answer.exercise.kind,
          expected: answer.grade.expected,
          given: answer.grade.given,
          correct: answer.grade.verdict === 'correct',
          accentOnly: answer.grade.verdict === 'accent',
          elapsedMs: answer.elapsedMs,
        })),
      })
    } catch (cause) {
      // Une écriture ratée en cours de route n'interrompt pas la session : ce qui
      // est déjà rangé l'est, et l'apprenant a mieux à faire que de recommencer.
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  /** Passe à la question suivante, ou termine. */
  function next(): void {
    if (status.value !== 'running' || answered.value === null) return

    if (index.value + 1 >= exercises.value.length) {
      status.value = 'done'
      return
    }
    index.value += 1
    shownAt = Date.now()
  }

  /** Remet le magasin à zéro, pour relancer une session depuis le bilan. */
  function reset(): void {
    status.value = 'idle'
    error.value = null
    exercises.value = []
    answers.value = []
    index.value = 0
    plan.value = null
    level.value = null
    focus.value = null
  }

  return {
    status,
    error,
    exercises,
    answers,
    index,
    plan,
    level,
    focus,
    current,
    answered,
    total,
    completed,
    summary,
    empty,
    start,
    submit,
    next,
    reset,
  }
})
