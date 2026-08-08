import { describe, expect, it } from 'vitest'

import { conjugateAll } from '@/conjugation'
import type { Tense } from '@/conjugation/types'

/**
 * Verbes défectifs : PLAN.md §4.
 *
 * Ce qui est vérifié ici n'est pas seulement la forme, mais l'absence de forme.
 * Une case vide est une information pédagogique : elle dit à l'apprenant que la
 * langue ne dispose pas de ce mot, là où une forme correctement construite mais
 * inusitée — `soleré`, `llovemos` — lui ferait retenir un usage qui n'existe pas.
 *
 * Tables écrites à la main, dérivées d'aucun code.
 */
const formsOf = (infinitive: string, tense: Tense) =>
  conjugateAll(infinitive, tense).map((form) => form?.value ?? null)

const NOBODY = [null, null, null, null, null, null]

/** Seule la troisième personne du singulier est remplie. */
const third = (form: string) => [null, null, form, null, null, null]

describe('llover — impersonnel', () => {
  const cases: Array<[Tense, Array<string | null>]> = [
    ['indicativo.presente', third('llueve')],
    ['indicativo.imperfecto', third('llovía')],
    ['indicativo.indefinido', third('llovió')],
    ['indicativo.futuro', third('lloverá')],
    ['indicativo.condicional', third('llovería')],
    ['subjuntivo.presente', third('llueva')],
    ['subjuntivo.imperfecto', third('lloviera')],
    ['indicativo.perfecto', third('ha llovido')],
    // On n'ordonne pas à la pluie de tomber.
    ['imperativo.afirmativo', NOBODY],
    ['imperativo.negativo', NOBODY],
  ]

  it.each(cases)('%s', (tense, expected) => {
    expect(formsOf('llover', tense)).toEqual(expected)
  })
})

describe('nevar — impersonnel, avec la diphtongaison de pensar', () => {
  const cases: Array<[Tense, Array<string | null>]> = [
    ['indicativo.presente', third('nieva')],
    ['indicativo.imperfecto', third('nevaba')],
    ['indicativo.indefinido', third('nevó')],
    ['indicativo.futuro', third('nevará')],
    ['subjuntivo.presente', third('nieve')],
    ['subjuntivo.imperfecto', third('nevara')],
    ['imperativo.afirmativo', NOBODY],
  ]

  it.each(cases)('%s', (tense, expected) => {
    expect(formsOf('nevar', tense)).toEqual(expected)
  })
})

describe('soler — défectif : l’habitude n’a ni futur ni impératif', () => {
  const present = ['suelo', 'sueles', 'suele', 'solemos', 'soléis', 'suelen']

  const cases: Array<[Tense, Array<string | null>]> = [
    ['indicativo.presente', present],
    ['indicativo.imperfecto', ['solía', 'solías', 'solía', 'solíamos', 'solíais', 'solían']],
    ['subjuntivo.presente', ['suela', 'suelas', 'suela', 'solamos', 'soláis', 'suelan']],
    [
      'subjuntivo.imperfecto',
      ['soliera', 'solieras', 'soliera', 'soliéramos', 'solierais', 'solieran'],
    ],
    [
      'indicativo.perfecto',
      ['he solido', 'has solido', 'ha solido', 'hemos solido', 'habéis solido', 'han solido'],
    ],
    // Les temps que `soler` n'a pas. Le moteur saurait les construire — `solí`,
    // `soleré`, `soled` — et c'est précisément ce qu'il ne faut pas montrer.
    ['indicativo.indefinido', NOBODY],
    ['indicativo.futuro', NOBODY],
    ['indicativo.condicional', NOBODY],
    ['subjuntivo.futuro', NOBODY],
    ['imperativo.afirmativo', NOBODY],
    ['imperativo.negativo', NOBODY],
  ]

  it.each(cases)('%s', (tense, expected) => {
    expect(formsOf('soler', tense)).toEqual(expected)
  })

  it('diphtongue comme contar là où il existe', () => {
    expect(formsOf('soler', 'indicativo.presente')).toEqual(present)
  })
})

describe('abolir — défectif : seules les terminaisons en i subsistent', () => {
  const cases: Array<[Tense, Array<string | null>]> = [
    // `abolo`, `aboles` n'existent pas : la terminaison ne commence pas par un i.
    ['indicativo.presente', [null, null, null, 'abolimos', 'abolís', null]],
    ['indicativo.imperfecto', ['abolía', 'abolías', 'abolía', 'abolíamos', 'abolíais', 'abolían']],
    [
      'indicativo.indefinido',
      ['abolí', 'aboliste', 'abolió', 'abolimos', 'abolisteis', 'abolieron'],
    ],
    [
      'indicativo.futuro',
      ['aboliré', 'abolirás', 'abolirá', 'aboliremos', 'aboliréis', 'abolirán'],
    ],
    [
      'subjuntivo.imperfecto',
      ['aboliera', 'abolieras', 'aboliera', 'aboliéramos', 'abolierais', 'abolieran'],
    ],
    // Tout le subjonctif présent tombe, et avec lui l'impératif négatif.
    ['subjuntivo.presente', NOBODY],
    ['imperativo.negativo', NOBODY],
    // `abolid` survit seul : l'impératif de vosotros vient de l'infinitif.
    ['imperativo.afirmativo', [null, null, null, null, 'abolid', null]],
  ]

  it.each(cases)('%s', (tense, expected) => {
    expect(formsOf('abolir', tense)).toEqual(expected)
  })
})
