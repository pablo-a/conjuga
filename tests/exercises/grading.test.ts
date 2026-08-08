import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import type { Form } from '@/conjugation'
import { grade, normalizeAnswer } from '@/exercises/grading'

const cell = (
  infinitive: string,
  ...at: [Parameters<typeof conjugate>[1], Parameters<typeof conjugate>[2]]
) => conjugate(infinitive, ...at)!

describe('normalizeAnswer', () => {
  it('ignore ce qui n’est jamais l’objet de l’exercice', () => {
    expect(normalizeAnswer('  Hablo  ')).toBe('hablo')
    expect(normalizeAnswer('HABLÓ')).toBe('habló')
  })

  it('préserve l’espace des temps composés', () => {
    // `he hablado` est une forme en deux mots : l'espace intérieur est significatif.
    expect(normalizeAnswer('  he   hablado ')).toBe('he hablado')
  })
})

describe('grade', () => {
  const presente = cell('hablar', 'indicativo.presente', 'yo')
  const indefinido = cell('hablar', 'indicativo.indefinido', 'el')

  it('accepte la forme exacte', () => {
    expect(grade('hablo', presente).verdict).toBe('correct')
    expect(grade('  HABLO ', presente).verdict).toBe('correct')
  })

  it('distingue la faute d’accent de la faute de forme', () => {
    // L'apprenant a trouvé la forme et manqué la syllabe tonique : ce n'est pas
    // la même erreur que d'avoir conjugué au mauvais temps.
    const accent = grade('hablo', indefinido)
    expect(accent.verdict).toBe('accent')
    expect(accent.expected).toBe('habló')

    expect(grade('hable', indefinido).verdict).toBe('wrong')
  })

  it('traite le tréma comme un accent, mais jamais le ñ', () => {
    const trema = cell('avergonzar', 'indicativo.presente', 'yo')
    expect(grade('averguenzo', trema).verdict).toBe('accent')

    // `año` et `ano` sont deux mots sans rapport : le ñ n'est pas un n décoré.
    const enseñar = cell('enseñar', 'indicativo.presente', 'yo')
    expect(enseñar.value).toBe('enseño')
    expect(grade('enseno', enseñar).verdict).toBe('wrong')
  })

  it('accepte indifféremment les deux subjonctifs imparfaits', () => {
    const form = cell('hablar', 'subjuntivo.imperfecto', 'yo')
    expect(grade('hablara', form).verdict).toBe('correct')
    expect(grade('hablase', form).verdict).toBe('correct')
  })

  it('renvoie la forme visée, pas systématiquement la principale', () => {
    // Celui qui écrit `hablaso` cherchait la forme en -se : lui répondre
    // `hablara` brouillerait la correction.
    const form = cell('hablar', 'subjuntivo.imperfecto', 'yo')
    expect(grade('hablaso', form).expected).toBe('hablase')
    expect(grade('hablaro', form).expected).toBe('hablara')
  })

  it('retient la forme principale quand la réponse est à égale distance des deux', () => {
    // `hablasa` est à une lettre de `hablara` comme de `hablase`. Rien ne permet
    // de trancher, et montrer la forme de référence est le choix le plus sûr.
    const form = cell('hablar', 'subjuntivo.imperfecto', 'yo')
    expect(grade('hablasa', form).expected).toBe(form.value)
  })

  it('corrige les temps composés', () => {
    const form = cell('escribir', 'indicativo.perfecto', 'yo')
    expect(grade('he escrito', form).verdict).toBe('correct')
    expect(grade('he escribido', form).verdict).toBe('wrong')
  })

  it('accepte les participes doubles', () => {
    const form = cell('freír', 'indicativo.perfecto', 'yo')
    expect(grade('he frito', form).verdict).toBe('correct')
    expect(grade('he freído', form).verdict).toBe('correct')
  })

  it('ne se laisse pas désarmer par une réponse vide', () => {
    const empty = grade('   ', presente)
    expect(empty.verdict).toBe('wrong')
    expect(empty.expected).toBe('hablo')
  })

  it('juge les formes irrégulières comme les autres', () => {
    const tuvo = cell('tener', 'indicativo.indefinido', 'el')
    expect(grade('tuvo', tuvo).verdict).toBe('correct')
    expect(grade('tuvó', tuvo).verdict).toBe('accent')
    expect(grade('tenió', tuvo).verdict).toBe('wrong')
  })

  it('n’invente jamais de verdict juste sur une forme voisine', () => {
    // `hable` (subjonctif) n'est pas `hablé` (prétérit) à un accent près : ce
    // sont deux cellules différentes, et l'accent les distingue vraiment.
    const preterite = cell('hablar', 'indicativo.indefinido', 'yo')
    expect(preterite.value).toBe('hablé')
    expect(grade('hable', preterite).verdict).toBe('accent')

    // En revanche une forme d'un autre verbe reste fausse.
    expect(grade('comí', preterite).verdict).toBe('wrong')
  })
})

describe('robustesse sur tout le paradigme', () => {
  it('accepte chaque forme que le moteur produit', () => {
    const verbs = ['hablar', 'tener', 'ir', 'dormir', 'avergonzar', 'reír']
    const tenses = [
      'indicativo.presente',
      'indicativo.indefinido',
      'subjuntivo.imperfecto',
    ] as const
    const persons = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'] as const

    for (const verb of verbs) {
      for (const tense of tenses) {
        for (const person of persons) {
          const form: Form | null = conjugate(verb, tense, person)
          if (!form) continue
          expect(grade(form.value, form).verdict, `${verb} ${tense} ${person}`).toBe('correct')
        }
      }
    }
  })
})
