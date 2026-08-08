import { describe, expect, it } from 'vitest'

import { grade } from '@/exercises/grading'
import { buildDrills, closesCard, reviewOf, tally } from '@/exercises/session'
import type { Drill, DrillAnswer } from '@/exercises/session'
import { cardId } from '@/srs/curriculum'
import type { Question } from '@/srs/selector'

/**
 * Ce module ne conjugue ni ne note : il découpe la session en cartes et sait
 * quand l'une d'elles est close. C'est exactement ce qui est vérifié ici.
 */

const question = (lemma: string, tense: string, person: string): Question =>
  ({ card: `${lemma}:${tense}`, person }) as Question

const answerOn = (drill: Drill, given: string, elapsedMs = 6000): DrillAnswer => ({
  drill,
  grade: grade(given, drill.form),
  elapsedMs,
})

describe('buildDrills', () => {
  it('attache à chaque question la cellule que l’apprenant doit produire', () => {
    const drills = buildDrills([question('hablar', 'indicativo.presente', 'yo')])

    expect(drills).toHaveLength(1)
    expect(drills[0]!.form.value).toBe('hablo')
    expect(drills[0]!.card).toBe(cardId('hablar', 'indicativo.presente'))
  })

  it('n’énonce jamais une question dont la case n’existe pas', () => {
    // `llover` est impersonnel : la carte a un sens, la première personne non.
    // Poser la question donnerait un champ que rien ne peut remplir.
    const drills = buildDrills([
      question('llover', 'indicativo.presente', 'yo'),
      question('llover', 'indicativo.presente', 'el'),
    ])

    expect(drills.map((drill) => drill.person)).toEqual(['el'])
  })
})

describe('closesCard', () => {
  const drills = buildDrills([
    question('hablar', 'indicativo.presente', 'yo'),
    question('hablar', 'indicativo.presente', 'tu'),
    question('comer', 'indicativo.presente', 'yo'),
  ])

  it('ne clôt pas une carte tant qu’il lui reste une personne', () => {
    expect(closesCard(drills, 0)).toBe(false)
  })

  it('clôt la carte à sa dernière personne', () => {
    expect(closesCard(drills, 1)).toBe(true)
  })

  it('clôt la dernière carte de la session', () => {
    expect(closesCard(drills, 2)).toBe(true)
  })

  it('ne clôt rien au-delà de la session', () => {
    expect(closesCard(drills, 3)).toBe(false)
  })
})

describe('reviewOf', () => {
  const drills = buildDrills([
    question('pensar', 'indicativo.presente', 'yo'),
    question('pensar', 'indicativo.presente', 'nosotros'),
    question('hablar', 'indicativo.presente', 'yo'),
  ])

  it('ne retient que les réponses de la carte notée', () => {
    const answers = [
      answerOn(drills[0]!, 'pienso'),
      answerOn(drills[1]!, 'pensamos'),
      answerOn(drills[2]!, 'nimportequoi'),
    ]

    const review = reviewOf(cardId('pensar', 'indicativo.presente'), answers)
    expect(review.answers).toHaveLength(2)
    expect(review.grade).toBe('good')
  })

  it('fait échouer la carte entière sur une seule forme fausse', () => {
    // Savoir `pienso` mais pas `pensamos`, ce n'est pas savoir le présent de
    // `pensar` : la carte porte le couple (verbe, temps).
    const answers = [answerOn(drills[0]!, 'pienso'), answerOn(drills[1]!, 'piensamos')]

    expect(reviewOf(cardId('pensar', 'indicativo.presente'), answers).grade).toBe('again')
  })

  it('range la faute d’accent comme fragile', () => {
    const drills = buildDrills([question('hablar', 'indicativo.indefinido', 'el')])
    const answers = [answerOn(drills[0]!, 'hablo')]

    expect(drills[0]!.form.value).toBe('habló')
    expect(reviewOf(drills[0]!.card, answers).grade).toBe('hard')
  })
})

describe('tally', () => {
  it('compte les verdicts et les cartes touchées', () => {
    const drills = buildDrills([
      question('hablar', 'indicativo.presente', 'yo'),
      question('hablar', 'indicativo.indefinido', 'el'),
      question('comer', 'indicativo.presente', 'yo'),
    ])

    const result = tally([
      answerOn(drills[0]!, 'hablo'),
      answerOn(drills[1]!, 'hablo'),
      answerOn(drills[2]!, 'como'),
    ])

    expect(result).toEqual({ correct: 2, accent: 1, wrong: 0, cards: 3 })
  })
})
