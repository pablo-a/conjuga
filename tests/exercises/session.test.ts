import { describe, expect, it } from 'vitest'

import { grade, gradeIdentification } from '@/exercises/grading'
import { buildExercises, closesCard, reviewOf, tally } from '@/exercises/session'
import type { Exercise, ExerciseAnswer } from '@/exercises/session'
import { cardId } from '@/srs/curriculum'
import type { Question } from '@/srs/selector'

/**
 * Ce module ne conjugue ni ne note : il découpe la session en cartes et sait
 * quand l'une d'elles est close. C'est exactement ce qui est vérifié ici.
 */

const question = (lemma: string, tense: string, person: string): Question =>
  ({ card: `${lemma}:${tense}`, person }) as Question

const answerOn = (exercise: Exercise, given: string, elapsedMs = 6000): ExerciseAnswer => ({
  exercise,
  grade: grade(given, exercise.form),
  elapsedMs,
})

describe('buildExercises', () => {
  it('attache à chaque question la cellule que l’apprenant doit produire', () => {
    const exercises = buildExercises([question('hablar', 'indicativo.presente', 'yo')])

    expect(exercises).toHaveLength(1)
    expect(exercises[0]!.form.value).toBe('hablo')
    expect(exercises[0]!.card).toBe(cardId('hablar', 'indicativo.presente'))
  })

  it('n’énonce jamais une question dont la case n’existe pas', () => {
    // `llover` est impersonnel : la carte a un sens, la première personne non.
    // Poser la question donnerait un champ que rien ne peut remplir.
    const exercises = buildExercises([
      question('llover', 'indicativo.presente', 'yo'),
      question('llover', 'indicativo.presente', 'el'),
    ])

    expect(exercises.map((exercise) => exercise.person)).toEqual(['el'])
  })
})

describe('closesCard', () => {
  const exercises = buildExercises([
    question('hablar', 'indicativo.presente', 'yo'),
    question('hablar', 'indicativo.presente', 'tu'),
    question('comer', 'indicativo.presente', 'yo'),
  ])

  it('ne clôt pas une carte tant qu’il lui reste une personne', () => {
    expect(closesCard(exercises, 0)).toBe(false)
  })

  it('clôt la carte à sa dernière personne', () => {
    expect(closesCard(exercises, 1)).toBe(true)
  })

  it('clôt la dernière carte de la session', () => {
    expect(closesCard(exercises, 2)).toBe(true)
  })

  it('ne clôt rien au-delà de la session', () => {
    expect(closesCard(exercises, 3)).toBe(false)
  })
})

describe('reviewOf', () => {
  const PENSAR = cardId('pensar', 'indicativo.presente')

  // Les cartes sont ici toutes considérées comme connues : `pensar` se voit donc
  // ajouter une identification en clôture, ce qui est justement ce qu'on veut
  // pour vérifier qu'elle ne pèse pas dans la note.
  const exercises = buildExercises([
    question('pensar', 'indicativo.presente', 'yo'),
    question('pensar', 'indicativo.presente', 'nosotros'),
    question('hablar', 'indicativo.presente', 'yo'),
  ])
  const drills = exercises.filter((exercise) => exercise.kind === 'drill')

  it('ne retient que les réponses de la carte notée', () => {
    const answers = [
      answerOn(drills[0]!, 'pienso'),
      answerOn(drills[1]!, 'pensamos'),
      answerOn(drills[2]!, 'nimportequoi'),
    ]

    const review = reviewOf(PENSAR, answers)
    expect(review.answers).toHaveLength(2)
    expect(review.grade).toBe('good')
  })

  it('fait échouer la carte entière sur une seule forme fausse', () => {
    // Savoir `pienso` mais pas `pensamos`, ce n'est pas savoir le présent de
    // `pensar` : la carte porte le couple (verbe, temps).
    const answers = [answerOn(drills[0]!, 'pienso'), answerOn(drills[1]!, 'piensamos')]

    expect(reviewOf(PENSAR, answers).grade).toBe('again')
  })

  it('ne note pas sur une identification ratée', () => {
    // Ne pas savoir nommer `pienso` en le lisant ne dit rien de la capacité à
    // l'écrire, qui est ce que l'échéance mesure.
    const identify = exercises.find((exercise) => exercise.kind === 'identify')!
    const answers = [
      answerOn(drills[0]!, 'pienso'),
      answerOn(drills[1]!, 'pensamos'),
      { exercise: identify, grade: gradeIdentification('faux', 'vrai'), elapsedMs: 6000 },
    ]

    const review = reviewOf(PENSAR, answers)
    expect(review.grade).toBe('good')
    // Rangée pour autant : elle a sa place dans le journal, pas dans la note.
    expect(review.answers).toHaveLength(3)
  })

  it('range la faute d’accent comme fragile', () => {
    const exercises = buildExercises([question('hablar', 'indicativo.indefinido', 'el')])
    const answers = [answerOn(exercises[0]!, 'hablo')]

    expect(exercises[0]!.form.value).toBe('habló')
    expect(reviewOf(exercises[0]!.card, answers).grade).toBe('hard')
  })
})

describe('tally', () => {
  it('compte les verdicts et les cartes touchées', () => {
    const exercises = buildExercises([
      question('hablar', 'indicativo.presente', 'yo'),
      question('hablar', 'indicativo.indefinido', 'el'),
      question('comer', 'indicativo.presente', 'yo'),
    ])

    const result = tally([
      answerOn(exercises[0]!, 'hablo'),
      answerOn(exercises[1]!, 'hablo'),
      answerOn(exercises[2]!, 'como'),
    ])

    expect(result).toEqual({ correct: 2, accent: 1, wrong: 0, cards: 3 })
  })
})
