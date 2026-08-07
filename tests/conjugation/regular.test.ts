import { describe, expect, it } from 'vitest'

import { conjugateAll, nonFinite } from '@/conjugation'
import type { Tense } from '@/conjugation/types'

/** Lit les six formes d'un temps sous forme de tableau de chaînes, `null` pour les cases vides. */
const formsOf = (infinitive: string, tense: Tense) =>
  conjugateAll(infinitive, tense).map((form) => form?.value ?? null)

/**
 * Tables de référence écrites à la main. Elles ne sont dérivées d'aucun code :
 * c'est le point fixe contre lequel le moteur est jugé.
 */
describe('hablar — modèle des -ar réguliers', () => {
  const cases: Array<[Tense, Array<string | null>]> = [
    ['indicativo.presente', ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan']],
    [
      'indicativo.imperfecto',
      ['hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablabais', 'hablaban'],
    ],
    ['indicativo.indefinido', ['hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron']],
    [
      'indicativo.futuro',
      ['hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablaréis', 'hablarán'],
    ],
    [
      'indicativo.condicional',
      ['hablaría', 'hablarías', 'hablaría', 'hablaríamos', 'hablaríais', 'hablarían'],
    ],
    ['subjuntivo.presente', ['hable', 'hables', 'hable', 'hablemos', 'habléis', 'hablen']],
    [
      'subjuntivo.imperfecto',
      ['hablara', 'hablaras', 'hablara', 'habláramos', 'hablarais', 'hablaran'],
    ],
    [
      'subjuntivo.futuro',
      ['hablare', 'hablares', 'hablare', 'habláremos', 'hablareis', 'hablaren'],
    ],
    ['imperativo.afirmativo', [null, 'habla', 'hable', 'hablemos', 'hablad', 'hablen']],
    ['imperativo.negativo', [null, 'hables', 'hable', 'hablemos', 'habléis', 'hablen']],
    [
      'indicativo.perfecto',
      ['he hablado', 'has hablado', 'ha hablado', 'hemos hablado', 'habéis hablado', 'han hablado'],
    ],
    [
      'indicativo.pluscuamperfecto',
      [
        'había hablado',
        'habías hablado',
        'había hablado',
        'habíamos hablado',
        'habíais hablado',
        'habían hablado',
      ],
    ],
    [
      'subjuntivo.perfecto',
      [
        'haya hablado',
        'hayas hablado',
        'haya hablado',
        'hayamos hablado',
        'hayáis hablado',
        'hayan hablado',
      ],
    ],
  ]

  it.each(cases)('%s', (tense, expected) => {
    expect(formsOf('hablar', tense)).toEqual(expected)
  })

  it('formes non conjuguées', () => {
    expect(nonFinite('hablar')).toMatchObject({ gerundio: 'hablando', participio: 'hablado' })
  })

  it('accepte la variante en -se au subjonctif imparfait', () => {
    const [yo] = conjugateAll('hablar', 'subjuntivo.imperfecto')
    expect(yo?.value).toBe('hablara')
    expect(yo?.alternatives).toContain('hablase')
  })

  it('ne signale aucune irrégularité', () => {
    for (const form of conjugateAll('hablar', 'indicativo.presente')) {
      expect(form?.irregularities).toEqual([])
      expect(form?.value).toBe(form?.regular)
    }
  })
})

describe('comer — modèle des -er réguliers', () => {
  const cases: Array<[Tense, Array<string | null>]> = [
    ['indicativo.presente', ['como', 'comes', 'come', 'comemos', 'coméis', 'comen']],
    ['indicativo.imperfecto', ['comía', 'comías', 'comía', 'comíamos', 'comíais', 'comían']],
    ['indicativo.indefinido', ['comí', 'comiste', 'comió', 'comimos', 'comisteis', 'comieron']],
    ['indicativo.futuro', ['comeré', 'comerás', 'comerá', 'comeremos', 'comeréis', 'comerán']],
    ['subjuntivo.presente', ['coma', 'comas', 'coma', 'comamos', 'comáis', 'coman']],
    [
      'subjuntivo.imperfecto',
      ['comiera', 'comieras', 'comiera', 'comiéramos', 'comierais', 'comieran'],
    ],
    ['imperativo.afirmativo', [null, 'come', 'coma', 'comamos', 'comed', 'coman']],
    ['imperativo.negativo', [null, 'comas', 'coma', 'comamos', 'comáis', 'coman']],
  ]

  it.each(cases)('%s', (tense, expected) => {
    expect(formsOf('comer', tense)).toEqual(expected)
  })

  it('formes non conjuguées', () => {
    expect(nonFinite('comer')).toMatchObject({ gerundio: 'comiendo', participio: 'comido' })
  })
})

describe('vivir — modèle des -ir réguliers', () => {
  const cases: Array<[Tense, Array<string | null>]> = [
    ['indicativo.presente', ['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven']],
    ['indicativo.imperfecto', ['vivía', 'vivías', 'vivía', 'vivíamos', 'vivíais', 'vivían']],
    ['indicativo.indefinido', ['viví', 'viviste', 'vivió', 'vivimos', 'vivisteis', 'vivieron']],
    ['indicativo.futuro', ['viviré', 'vivirás', 'vivirá', 'viviremos', 'viviréis', 'vivirán']],
    ['subjuntivo.presente', ['viva', 'vivas', 'viva', 'vivamos', 'viváis', 'vivan']],
    ['imperativo.afirmativo', [null, 'vive', 'viva', 'vivamos', 'vivid', 'vivan']],
  ]

  it.each(cases)('%s', (tense, expected) => {
    expect(formsOf('vivir', tense)).toEqual(expected)
  })

  it('formes non conjuguées', () => {
    expect(nonFinite('vivir')).toMatchObject({ gerundio: 'viviendo', participio: 'vivido' })
  })

  it('ne diffère de comer qu’à nosotros et vosotros du présent', () => {
    // C'est la seule différence réelle entre les deux groupes au présent : la
    // confondre est l'erreur la plus fréquente en début d'apprentissage.
    expect(formsOf('vivir', 'indicativo.presente').slice(3, 5)).toEqual(['vivimos', 'vivís'])
    expect(formsOf('comer', 'indicativo.presente').slice(3, 5)).toEqual(['comemos', 'coméis'])
  })
})

describe('haber — auxiliaire des temps composés', () => {
  it('présent de l’indicatif', () => {
    expect(formsOf('haber', 'indicativo.presente')).toEqual([
      'he',
      'has',
      'ha',
      'hemos',
      'habéis',
      'han',
    ])
  })

  it('présent du subjonctif', () => {
    expect(formsOf('haber', 'subjuntivo.presente')).toEqual([
      'haya',
      'hayas',
      'haya',
      'hayamos',
      'hayáis',
      'hayan',
    ])
  })

  it('signale ses formes comme irrégulières', () => {
    const [yo] = conjugateAll('haber', 'indicativo.presente')
    expect(yo?.value).toBe('he')
    expect(yo?.regular).toBe('habo')
    expect(yo?.irregularities.length).toBeGreaterThan(0)
  })
})

describe('entrées invalides', () => {
  it('refuse ce qui n’est pas un infinitif conjugable', () => {
    expect(() => conjugateAll('casa', 'indicativo.presente')).toThrow(/infinitif/i)
  })
})
