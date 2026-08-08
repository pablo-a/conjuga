import { describe, expect, it } from 'vitest'

import { MIN_ATTEMPTS, byTense, isMeaningful, successRate, totalFor, weakest } from '@/srs/patterns'
import type { PatternCount } from '@/srs/patterns'

const count = (over: Partial<PatternCount> = {}): PatternCount => ({
  model: 'pensar',
  tense: 'indicativo.presente',
  attempts: 20,
  errors: 5,
  ...over,
})

describe('successRate', () => {
  it('rend la part de formes trouvées', () => {
    expect(successRate({ attempts: 20, errors: 5 })).toBe(0.75)
    expect(successRate({ attempts: 10, errors: 0 })).toBe(1)
  })

  it('ne divise pas par zéro sur un patron jamais tenté', () => {
    expect(successRate({ attempts: 0, errors: 0 })).toBe(0)
  })
})

describe('isMeaningful', () => {
  it('refuse de conclure sur trop peu de formes', () => {
    // Une forme ratée une fois donne 100 % d'échec : ce n'est pas une faiblesse,
    // c'est un manque de données, et envoyer relire une fiche sur cette base
    // ferait perdre du temps sur un patron peut-être acquis.
    expect(isMeaningful({ attempts: 1, errors: 1 })).toBe(false)
    expect(isMeaningful({ attempts: MIN_ATTEMPTS - 1, errors: 0 })).toBe(false)
    expect(isMeaningful({ attempts: MIN_ATTEMPTS, errors: 0 })).toBe(true)
  })
})

describe('byTense', () => {
  it('cumule les modèles d’un même temps', () => {
    const scores = byTense([
      count({ model: 'pensar', attempts: 20, errors: 5 }),
      count({ model: 'contar', attempts: 10, errors: 1 }),
      count({ model: 'pensar', tense: 'indicativo.indefinido', attempts: 8, errors: 4 }),
    ])

    expect(scores.get('indicativo.presente')).toEqual({ attempts: 30, errors: 6 })
    expect(scores.get('indicativo.indefinido')).toEqual({ attempts: 8, errors: 4 })
  })
})

describe('totalFor', () => {
  it('additionne les temps que couvre une fiche', () => {
    // La fiche transversale porte sur deux temps : sa maîtrise est celle des
    // deux ensemble, puisque c'est ensemble qu'ils se confondent.
    const counts = [
      count({ tense: 'indicativo.indefinido', attempts: 12, errors: 6 }),
      count({ tense: 'indicativo.imperfecto', attempts: 8, errors: 0 }),
      count({ tense: 'indicativo.presente', attempts: 50, errors: 1 }),
    ]

    expect(totalFor(counts, ['indicativo.indefinido', 'indicativo.imperfecto'])).toEqual({
      attempts: 20,
      errors: 6,
    })
  })

  it('rend zéro quand aucun temps ne correspond', () => {
    expect(totalFor([count()], ['subjuntivo.presente'])).toEqual({ attempts: 0, errors: 0 })
  })
})

describe('weakest', () => {
  const tenses = ['indicativo.presente'] as const

  it('classe du plus raté au moins raté', () => {
    const worst = count({ model: 'pedir', attempts: 20, errors: 15 })
    const middling = count({ model: 'pensar', attempts: 20, errors: 5 })

    expect(weakest([middling, worst], tenses).map((pattern) => pattern.model)).toEqual([
      'pedir',
      'pensar',
    ])
  })

  it('écarte les patrons sans erreur', () => {
    // Une liste de faiblesses qui contient des réussites n'en est plus une.
    expect(weakest([count({ errors: 0 })], tenses)).toEqual([])
  })

  it('écarte les patrons trop peu tentés', () => {
    expect(weakest([count({ attempts: 2, errors: 2 })], tenses)).toEqual([])
  })

  it('ignore les temps que la fiche ne couvre pas', () => {
    expect(weakest([count({ tense: 'subjuntivo.presente' })], tenses)).toEqual([])
  })

  it('s’arrête au nombre demandé', () => {
    const many = ['pedir', 'pensar', 'contar', 'jugar'].map((model, index) =>
      count({ model, errors: 15 - index }),
    )
    expect(weakest(many, tenses)).toHaveLength(3)
  })
})
