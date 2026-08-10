import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import type { Person, Tense } from '@/conjugation'
import {
  MIN_OPTIONS,
  hidesItsInfinitive,
  identificationOf,
  identityKey,
} from '@/exercises/identification'

/**
 * L'exercice inverse travaille la lecture, la seule compétence que le reste de
 * l'app n'exerce jamais. Ce qui est vérifié ici, c'est qu'il la travaille : une
 * question dont les leurres se rejettent d'un coup d'œil, ou qui a deux bonnes
 * réponses, ne vaudrait pas la peine d'être posée.
 */

const A2: readonly Tense[] = [
  'indicativo.presente',
  'indicativo.perfecto',
  'indicativo.indefinido',
  'indicativo.imperfecto',
  'indicativo.futuro',
  'indicativo.condicional',
]

const LEMMAS = ['ser', 'estar', 'ir', 'tener', 'hacer', 'poder', 'hablar', 'pensar']

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

function ask(lemma: string, tense: Tense, person: Person, seed = 11) {
  const form = conjugate(lemma, tense, person)
  if (form === null) throw new Error(`${lemma} n’a pas de ${tense} à la ${person}e personne`)
  return identificationOf(lemma, tense, person, form.value, {
    tenses: A2,
    lemmas: LEMMAS,
    random: seeded(seed),
  })
}

describe('formes qui cachent leur infinitif', () => {
  it('reconnaît celles qui ne montrent pas leur verbe', () => {
    // C'est exactement là que la lecture bute : le radical ne dit plus le verbe.
    expect(hidesItsInfinitive('tener', 'indicativo.indefinido', 'tuvieron')).toBe(true)
    expect(hidesItsInfinitive('ser', 'indicativo.indefinido', 'fui')).toBe(true)
    expect(hidesItsInfinitive('pensar', 'indicativo.presente', 'pienso')).toBe(true)
  })

  it('laisse tranquilles celles qui l’écrivent en toutes lettres', () => {
    // Demander à quel verbe appartient `hablaron` n'apprendrait rien : il est
    // écrit dedans.
    expect(hidesItsInfinitive('hablar', 'indicativo.indefinido', 'hablaron')).toBe(false)
    expect(hidesItsInfinitive('comer', 'indicativo.imperfecto', 'comía')).toBe(false)
  })

  it('écarte les temps composés', () => {
    // `he tenido` porte son verbe, et son auxiliaire annonce déjà le temps.
    expect(hidesItsInfinitive('tener', 'indicativo.perfecto', 'he tenido')).toBe(false)
  })
})

describe('identification', () => {
  it('propose la bonne identité une fois et une seule', () => {
    const question = ask('tener', 'indicativo.indefinido', 'ellos')!
    const right = question.options.filter((option) => option.correct)

    expect(right).toHaveLength(1)
    expect(right[0]!.value).toBe(
      identityKey({ lemma: 'tener', tense: 'indicativo.indefinido', person: 'ellos' }),
    )
  })

  it('ne fait dévier chaque leurre que sur une seule dimension', () => {
    // Une option fausse sur deux points se rejette sur le premier venu, et la
    // question ne porterait plus que sur lui.
    const question = ask('tener', 'indicativo.indefinido', 'ellos')!

    for (const option of question.options) {
      if (option.correct) continue
      const deviations = [
        option.lemma !== 'tener',
        option.tense !== 'indicativo.indefinido',
        option.person !== 'ellos',
      ].filter(Boolean)
      expect(deviations, option.value).toHaveLength(1)
    }
  })

  it('varie les dimensions plutôt que d’épuiser la première', () => {
    // Trois leurres qui ne changent que la personne ne posent qu'une question.
    const question = ask('tener', 'indicativo.indefinido', 'ellos')!
    const dimensions = new Set(
      question.options
        .filter((option) => !option.correct)
        .map((option) =>
          option.lemma !== 'tener'
            ? 'lemma'
            : option.tense !== 'indicativo.indefinido'
              ? 'tense'
              : 'person',
        ),
    )

    expect(dimensions.size).toBeGreaterThan(1)
  })

  it('n’oppose jamais deux identités qui désignent la même forme', () => {
    /*
     * Le piège du format, et il est fréquent : `hablaba` est l'imparfait de `yo`
     * **et** de `él`, `hablamos` le présent et le passé simple de `nosotros`.
     * Sans garde, la question aurait deux réponses justes et l'apprenant serait
     * compté faux pour avoir eu raison.
     */
    for (const lemma of ['hablar', 'comer', 'vivir', 'ser', 'ir', 'tener', 'pensar']) {
      for (const tense of A2) {
        for (const person of ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'] as Person[]) {
          const form = conjugate(lemma, tense, person)
          if (form === null) continue

          const question = identificationOf(lemma, tense, person, form.value, {
            tenses: A2,
            lemmas: LEMMAS,
            random: seeded(5),
          })
          if (question === null) continue

          for (const option of question.options) {
            if (option.correct) continue
            const designated = conjugate(option.lemma, option.tense, option.person)
            expect(designated?.value, `${lemma} ${tense} ${person} → ${option.value}`).not.toBe(
              form.value,
            )
          }
        }
      }
    }
  })

  it('ne propose jamais une case qui n’existe pas', () => {
    // `llover` n'a que la troisième personne : une option sur `yo` ne désignerait
    // rien du tout.
    const question = ask('llover', 'indicativo.indefinido', 'el')
    for (const option of question?.options ?? []) {
      expect(conjugate(option.lemma, option.tense, option.person)).not.toBeNull()
    }
  })

  it('dit ce qui cloche dans chaque mauvaise proposition', () => {
    const question = ask('tener', 'indicativo.indefinido', 'ellos')!

    for (const option of question.options) {
      if (option.correct) expect(option.label).toBeUndefined()
      else expect(option.label, option.value).toMatch(/^Pas (le bon|la bonne)/)
    }
  })

  it('refuse la question quand elle se jouerait à pile ou face', () => {
    // Sans temps ni verbes à opposer, il ne reste que les personnes — et sur un
    // verbe impersonnel, elles n'existent pas.
    expect(identificationOf('llover', 'indicativo.presente', 'el', 'llueve', {})).toBeNull()
  })

  it('en propose quatre quand il y a de quoi', () => {
    const question = ask('hacer', 'indicativo.futuro', 'yo')!

    expect(question.options.length).toBe(4)
    expect(question.options.length).toBeGreaterThanOrEqual(MIN_OPTIONS)
    expect(new Set(question.options.map((option) => option.value)).size).toBe(4)
  })

  it('ne place pas la bonne réponse toujours au même endroit', () => {
    const positions = new Set<number>()
    for (let seed = 1; seed < 40; seed++) {
      const question = ask('tener', 'indicativo.indefinido', 'ellos', seed)!
      positions.add(question.options.findIndex((option) => option.correct))
    }

    expect(positions.size).toBeGreaterThan(2)
  })
})
