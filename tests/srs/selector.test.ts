import { describe, expect, it } from 'vitest'

import { cardId } from '@/srs/curriculum'
import {
  BACKLOG_PAUSE,
  availablePersons,
  pickPersons,
  planSession,
  questionsFor,
} from '@/srs/selector'
import type { DeckEntry } from '@/srs/selector'

const NOW = new Date('2026-08-08T09:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000)
const ahead = (days: number) => new Date(NOW.getTime() + days * 86_400_000)

/** Hasard déterministe : un générateur congruentiel suffit et rend les tests stables. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

const card = (n: number) => `verbe${n}:indicativo.presente`

describe('planSession', () => {
  it('ne propose rien qui ne soit débloqué', () => {
    const deck: DeckEntry[] = [
      { id: card(1), due: ago(1) },
      { id: card(2), due: ago(1) },
    ]
    const plan = planSession(deck, [card(1)], NOW)
    expect(plan.cards).toEqual([card(1)])
  })

  it('ignore les cartes qui ne sont pas encore dues', () => {
    const deck: DeckEntry[] = [
      { id: card(1), due: ahead(2) },
      { id: card(2), due: ago(1) },
    ]
    expect(planSession(deck, [card(1), card(2)], NOW).cards).toEqual([card(2)])
  })

  it('traite d’abord le plus en retard', () => {
    const deck: DeckEntry[] = [
      { id: card(1), due: ago(1) },
      { id: card(2), due: ago(9) },
      { id: card(3), due: ago(4) },
    ]
    const plan = planSession(deck, [card(1), card(2), card(3)], NOW, { newPerSession: 0 })
    expect(plan.cards).toEqual([card(2), card(3), card(1)])
  })

  it('introduit des cartes neuves dans l’ordre du curriculum', () => {
    const plan = planSession([], [card(1), card(2), card(3)], NOW, { newPerSession: 2 })
    expect(plan.cards).toEqual([card(1), card(2)])
    expect(plan.introduced).toBe(2)
  })

  it('répartit les nouveautés au lieu de les grouper', () => {
    // Enchaîner les formes inconnues d'affilée est le meilleur moyen de n'en
    // retenir aucune.
    const deck: DeckEntry[] = Array.from({ length: 6 }, (_, index) => ({
      id: card(index),
      due: ago(1),
    }))
    const unlocked = [...deck.map((entry) => entry.id), card(90), card(91)]
    const plan = planSession(deck, unlocked, NOW, { newPerSession: 2 })

    const positions = [plan.cards.indexOf(card(90)), plan.cards.indexOf(card(91))]
    expect(positions[0]).toBeGreaterThanOrEqual(0)
    expect(positions[1]! - positions[0]!).toBeGreaterThan(1)
  })

  it('suspend les nouveautés quand le retard devient ingérable', () => {
    // La spirale d'abandon d'Anki : ajouter du neuf sur un retard qu'on ne
    // résorbe plus transforme la session en punition.
    const deck: DeckEntry[] = Array.from({ length: BACKLOG_PAUSE + 5 }, (_, index) => ({
      id: card(index),
      due: ago(2),
    }))
    const plan = planSession(deck, [...deck.map((entry) => entry.id), card(999)], NOW)

    expect(plan.paused).toBe(true)
    expect(plan.introduced).toBe(0)
    expect(plan.cards).not.toContain(card(999))
    expect(plan.backlog).toBe(BACKLOG_PAUSE + 5)
  })

  it('reprend les nouveautés dès que le retard repasse sous le seuil', () => {
    const deck: DeckEntry[] = Array.from({ length: BACKLOG_PAUSE }, (_, index) => ({
      id: card(index),
      due: ago(2),
    }))
    const plan = planSession(deck, [...deck.map((entry) => entry.id), card(999)], NOW)
    expect(plan.paused).toBe(false)
    expect(plan.introduced).toBe(1)
  })

  it('tient dans le budget de temps plutôt que dans un compte fixe', () => {
    const deck: DeckEntry[] = Array.from({ length: 200 }, (_, index) => ({
      id: card(index),
      due: ago(1),
    }))
    const unlocked = deck.map((entry) => entry.id)

    // 20 minutes, ~10 s par question, 2,5 questions par carte → ~48 cartes.
    const normal = planSession(deck, unlocked, NOW, { newPerSession: 0 })
    expect(normal.cards.length).toBeGreaterThan(40)
    expect(normal.cards.length).toBeLessThan(55)

    // Moitié moins de temps, moitié moins de cartes.
    const short = planSession(deck, unlocked, NOW, {
      newPerSession: 0,
      budgetMs: 10 * 60 * 1000,
    })
    expect(short.cards.length).toBeLessThan(normal.cards.length)
  })

  it('propose au moins une carte, même avec un budget minuscule', () => {
    const deck: DeckEntry[] = [{ id: card(1), due: ago(1) }]
    expect(planSession(deck, [card(1)], NOW, { budgetMs: 1 }).cards).toHaveLength(1)
  })
})

describe('choix des personnes', () => {
  const presente = cardId('hablar', 'indicativo.presente')

  it('pose trois personnes sur un verbe complet', () => {
    expect(pickPersons(presente, [], seeded(1))).toHaveLength(3)
  })

  it('n’en pose jamais une qui n’existe pas', () => {
    // `llover` n'a que la troisième personne du singulier : la pluie n'est le
    // sujet de personne.
    const llover = cardId('llover', 'indicativo.presente')
    expect(availablePersons(llover)).toEqual(['el'])
    expect(pickPersons(llover, [], seeded(1))).toEqual(['el'])

    // À l'impératif, `yo` n'existe pour aucun verbe.
    const imperatif = cardId('hablar', 'imperativo.afirmativo')
    expect(availablePersons(imperatif)).not.toContain('yo')
  })

  it('favorise les personnes déjà ratées', () => {
    // Repasser au hasard reviendrait à réviser surtout ce qu'on sait déjà.
    const picked = pickPersons(presente, ['vosotros', 'nosotros'], seeded(7))
    expect(picked).toContain('vosotros')
    expect(picked).toContain('nosotros')
  })

  it('ne tombe pas toujours sur la même quand tout est raté', () => {
    const all = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'] as const
    const first = pickPersons(presente, all, seeded(3))
    const second = pickPersons(presente, all, seeded(99))
    expect(first).not.toEqual(second)
  })

  it('ne répète jamais une personne dans un même tirage', () => {
    for (let seed = 1; seed < 30; seed++) {
      const picked = pickPersons(presente, ['el'], seeded(seed))
      expect(new Set(picked).size).toBe(picked.length)
    }
  })
})

describe('questionsFor', () => {
  it('développe le plan en questions, carte par carte', () => {
    const deck: DeckEntry[] = [
      { id: cardId('hablar', 'indicativo.presente'), due: ago(1), weakPersons: ['vosotros'] },
      { id: cardId('llover', 'indicativo.presente'), due: ago(1) },
    ]
    const plan = planSession(
      deck,
      deck.map((entry) => entry.id),
      NOW,
      { newPerSession: 0 },
    )
    const questions = questionsFor(plan, deck, seeded(5))

    // Trois personnes pour `hablar`, une seule pour `llover` qui est défectif.
    expect(questions).toHaveLength(4)
    expect(questions.filter((q) => q.card.startsWith('llover'))).toEqual([
      { card: 'llover:indicativo.presente', person: 'el' },
    ])
    expect(questions.filter((q) => q.card.startsWith('hablar')).map((q) => q.person)).toContain(
      'vosotros',
    )
  })
})
