import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import type { Form, Person, Tense } from '@/conjugation'
import { MIN_CHOICES, multipleChoice } from '@/exercises/recognition'

const A2: readonly Tense[] = [
  'indicativo.presente',
  'indicativo.perfecto',
  'indicativo.indefinido',
  'indicativo.imperfecto',
  'indicativo.futuro',
  'indicativo.condicional',
]

function cell(lemma: string, tense: Tense, person: Person): Form {
  const form = conjugate(lemma, tense, person)
  if (form === null) throw new Error(`${lemma} n’a pas de ${tense} à la ${person}e personne`)
  return form
}

/** Hasard déterministe : un générateur congruentiel suffit et rend les tests stables. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('QCM', () => {
  it('contient la bonne réponse une fois et une seule', () => {
    const question = multipleChoice(
      'pensar',
      'indicativo.presente',
      'yo',
      cell('pensar', 'indicativo.presente', 'yo'),
      { tenses: A2, random: seeded(3) },
    )!

    const correct = question.choices.filter((choice) => choice.correct)
    expect(correct).toHaveLength(1)
    expect(correct[0]!.value).toBe('pienso')
  })

  it('propose quatre formes par défaut, toutes différentes', () => {
    const question = multipleChoice(
      'tener',
      'indicativo.indefinido',
      'yo',
      cell('tener', 'indicativo.indefinido', 'yo'),
      { tenses: A2, random: seeded(3) },
    )!

    expect(question.choices).toHaveLength(4)
    expect(new Set(question.choices.map((choice) => choice.value)).size).toBe(4)
  })

  it('dit ce qu’était chaque mauvaise réponse', () => {
    // Une croix rouge n'apprend rien. « c'était le présent » situe l'erreur, et
    // c'est ce que la reconnaissance doit rendre au moment de la correction.
    const question = multipleChoice(
      'pensar',
      'indicativo.presente',
      'yo',
      cell('pensar', 'indicativo.presente', 'yo'),
      { tenses: A2, random: seeded(3) },
    )!

    for (const choice of question.choices) {
      if (choice.correct) expect(choice.label).toBeUndefined()
      else expect(choice.label, choice.value).toBeTruthy()
    }
  })

  it('ne place pas la bonne réponse toujours au même endroit', () => {
    // Une bonne réponse qui tombe rarement en première ligne s'apprend aussi
    // vite que la conjugaison elle-même.
    const positions = new Set<number>()
    for (let seed = 1; seed < 40; seed++) {
      const question = multipleChoice(
        'hablar',
        'indicativo.indefinido',
        'el',
        cell('hablar', 'indicativo.indefinido', 'el'),
        { tenses: A2, random: seeded(seed) },
      )!
      positions.add(question.choices.findIndex((choice) => choice.correct))
    }

    expect(positions.size).toBeGreaterThan(2)
  })

  it('refuse de poser une question qui se joue à pile ou face', () => {
    // Un verbe impersonnel donne peu de leurres : à deux propositions, répondre
    // au hasard réussit une fois sur deux et une carte peut être repoussée sur
    // un coup de pièce. On préfère ne pas poser la question.
    const question = multipleChoice(
      'llover',
      'indicativo.presente',
      'el',
      cell('llover', 'indicativo.presente', 'el'),
      { tenses: [], count: 1, random: seeded(3) },
    )

    expect(question).toBeNull()
  })

  it('pose la question dès qu’il y a de quoi la poser', () => {
    const question = multipleChoice(
      'llover',
      'indicativo.presente',
      'el',
      cell('llover', 'indicativo.presente', 'el'),
      { tenses: A2, random: seeded(3) },
    )

    expect(question).not.toBeNull()
    expect(question!.choices.length).toBeGreaterThanOrEqual(MIN_CHOICES)
  })

  it('ne propose jamais une forme qui serait acceptée à la place de l’autre', () => {
    // La garantie qui compte : deux propositions justes rendraient la question
    // insoluble, et une carte serait comptée fausse à tort.
    for (const lemma of ['hablar', 'ser', 'ir', 'tener', 'pedir', 'volver', 'buscar']) {
      for (const tense of A2) {
        for (const person of ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'] as Person[]) {
          const form = conjugate(lemma, tense, person)
          if (form === null) continue

          const question = multipleChoice(lemma, tense, person, form, {
            tenses: A2,
            random: seeded(7),
          })
          if (question === null) continue

          const accepted = new Set([form.value, ...form.alternatives])
          const right = question.choices.filter((choice) => accepted.has(choice.value))
          expect(right.length, `${lemma} ${tense} ${person}`).toBe(1)
          expect(right[0]!.correct).toBe(true)
        }
      }
    }
  })
})
