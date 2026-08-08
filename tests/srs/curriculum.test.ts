import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import { PERSONS } from '@/conjugation/types'
import {
  LEVELS,
  MASTERY_RATIO,
  MASTERY_STABILITY_DAYS,
  cardId,
  currentLevel,
  mastery,
  parseCardId,
  unlockedCards,
  unlockedLevels,
} from '@/srs/curriculum'
import type { CardId, Progress } from '@/srs/curriculum'

const nothing: Progress = new Map()

/** Progression fictive : ces cartes sont acquises, les autres non. */
const learned = (cards: readonly CardId[]): Progress =>
  new Map(cards.map((card) => [card, MASTERY_STABILITY_DAYS]))

describe('identifiant de carte', () => {
  it('fait l’aller-retour sans perte', () => {
    const id = cardId('tener', 'indicativo.presente')
    expect(id).toBe('tener:indicativo.presente')
    expect(parseCardId(id)).toEqual({ lemma: 'tener', tense: 'indicativo.presente' })
  })
})

describe('les niveaux', () => {
  it('ne contiennent que des cartes qui existent vraiment', () => {
    // Un verbe défectif n'a pas tous les temps : une carte sans aucune forme
    // serait une question sans réponse.
    const empty: string[] = []
    for (const level of LEVELS) {
      for (const card of level.cards) {
        const { lemma, tense } = parseCardId(card)
        const has = PERSONS.some((person) => conjugate(lemma, tense, person) !== null)
        if (!has) empty.push(card)
      }
    }
    expect(empty).toEqual([])
  })

  it('ne répètent jamais une carte à l’intérieur d’un niveau', () => {
    for (const level of LEVELS) {
      expect(new Set(level.cards).size, level.id).toBe(level.cards.length)
    }
  })

  it('commencent par le présent des verbes les plus fréquents', () => {
    const first = LEVELS[0]!
    expect(first.cards).toContain('ser:indicativo.presente')
    expect(first.cards).toContain('tener:indicativo.presente')
    expect(first.cards.every((card) => card.endsWith(':indicativo.presente'))).toBe(true)
  })

  it('donnent tous les temps aux quatre verbes essentiels', () => {
    const essentiels = LEVELS.find((level) => level.id === 'essentiels')!
    for (const lemma of ['ser', 'estar', 'ir', 'haber']) {
      expect(essentiels.cards).toContain(cardId(lemma, 'indicativo.indefinido'))
      expect(essentiels.cards).toContain(cardId(lemma, 'indicativo.perfecto'))
    }
  })

  it('remettent les deux passés en circulation ensemble', () => {
    // C'est tout l'objet du niveau : cesser de réviser chaque temps dans son
    // couloir, puisque le piège est de les confondre.
    const mixte = LEVELS.find((level) => level.id === 'pasado-mixto')!
    const tenses = new Set(mixte.cards.map((card) => parseCardId(card).tense))
    expect([...tenses].sort()).toEqual(['indicativo.imperfecto', 'indicativo.indefinido'])
  })

  it('gardent le subjonctif pour la fin', () => {
    expect(LEVELS[LEVELS.length - 1]!.id).toBe('subjuntivo')
  })
})

describe('déblocage', () => {
  it('ouvre le premier niveau à quelqu’un qui n’a rien fait', () => {
    const open = unlockedLevels(nothing)
    expect(open).toHaveLength(1)
    expect(open[0]!.id).toBe('presente-50')
    expect(currentLevel(nothing).id).toBe('presente-50')
  })

  it('n’ouvre le suivant qu’au seuil de maîtrise', () => {
    const first = LEVELS[0]!
    const justUnder = Math.floor(first.cards.length * MASTERY_RATIO) - 1

    expect(unlockedLevels(learned(first.cards.slice(0, justUnder)))).toHaveLength(1)
    expect(unlockedLevels(learned(first.cards)).length).toBeGreaterThan(1)
  })

  it('s’arrête au premier niveau non acquis, même si un niveau plus loin l’est', () => {
    // Sauter un trou ouvrirait des cartes dont les prérequis ne sont pas là.
    const third = LEVELS[2]!
    const open = unlockedLevels(learned([...LEVELS[0]!.cards, ...third.cards]))

    expect(open.map((level) => level.id)).toEqual(['presente-50', 'essentiels'])
  })

  it('mesure la maîtrise sur la stabilité, pas sur le simple fait d’avoir vu la carte', () => {
    const first = LEVELS[0]!
    const seen: Progress = new Map(first.cards.map((card) => [card, MASTERY_STABILITY_DAYS - 1]))
    expect(mastery(first, seen)).toBe(0)
    expect(mastery(first, learned(first.cards))).toBe(1)
  })

  it('ne propose aucune carte en double, même quand un temps revient', () => {
    // `pasado-mixto` reprend les cartes des niveaux 4 et 5 : ouvertes deux fois,
    // elles ne doivent apparaître qu'une.
    const everything = learned(LEVELS.flatMap((level) => level.cards))
    const cards = unlockedCards(everything)
    expect(new Set(cards).size).toBe(cards.length)
  })

  it('ouvre tout le programme à qui a tout acquis', () => {
    const everything = learned(LEVELS.flatMap((level) => level.cards))
    expect(unlockedLevels(everything)).toHaveLength(LEVELS.length)
  })
})
