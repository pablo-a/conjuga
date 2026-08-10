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

/*
 * Le budget appartient à la **journée**, pas à la session. C'est ce qui permet à
 * une journée de se terminer : sans cela, revenir sur l'accueil après une séance
 * en recomposait une entière, dix nouveautés comprises, et le décompte annoncé ne
 * bougeait jamais quoi qu'on révise.
 */
describe('budget quotidien', () => {
  const backlog = (count: number): DeckEntry[] =>
    Array.from({ length: count }, (_, index) => ({ id: card(index), due: ago(1) }))

  it('retranche du budget ce que la journée a déjà coûté', () => {
    const deck = backlog(200)
    const unlocked = deck.map((entry) => entry.id)

    const morning = planSession(deck, unlocked, NOW, { newPerSession: 0 })
    const afternoon = planSession(deck, unlocked, NOW, {
      newPerSession: 0,
      today: { planned: 20, introduced: 0 },
    })

    expect(afternoon.cards).toHaveLength(morning.cards.length - 20)
  })

  it('ne propose plus rien une fois la journée faite', () => {
    const deck = backlog(200)
    const plan = planSession(
      deck,
      deck.map((entry) => entry.id),
      NOW,
      { newPerSession: 0, today: { planned: 500, introduced: 0 } },
    )

    // Zéro, et non « au moins une » : le plancher du budget minuscule ne doit pas
    // rouvrir une journée close.
    expect(plan.cards).toEqual([])
  })

  it('plafonne les nouveautés sur la journée, pas sur la session', () => {
    const unlocked = Array.from({ length: 50 }, (_, index) => card(index))

    expect(planSession([], unlocked, NOW).introduced).toBe(10)
    expect(
      planSession([], unlocked, NOW, { today: { planned: 6, introduced: 6 } }).introduced,
    ).toBe(4)
    expect(
      planSession([], unlocked, NOW, { today: { planned: 10, introduced: 10 } }).introduced,
    ).toBe(0)
  })

  it('garde l’objectif du jour stable à mesure qu’on avance', () => {
    // C'est la propriété qui rend le « 12 / 48 » de l'accueil crédible : ce qu'on
    // retire du reste, on l'a ajouté au fait. Un objectif qui bouge n'en est pas un.
    const deck = backlog(200)
    const unlocked = deck.map((entry) => entry.id)
    const start = planSession(deck, unlocked, NOW, { newPerSession: 0 })

    for (const planned of [0, 1, 12, 30, start.goal]) {
      const later = planSession(deck, unlocked, NOW, {
        newPerSession: 0,
        today: { planned, introduced: 0 },
      })
      expect(later.goal, `après ${planned} cartes`).toBe(start.goal)
      expect(planned + later.cards.length).toBe(start.goal)
    }
  })

  it('n’enfle pas l’objectif d’un travail qui n’était pas au programme', () => {
    // Une session ciblée révise en avance : `saveReview` ne la compte pas dans
    // `planned`, et l'objectif du jour ne doit donc pas s'en apercevoir.
    const deck = backlog(3)
    const unlocked = deck.map((entry) => entry.id)

    expect(planSession(deck, unlocked, NOW, { newPerSession: 0 }).goal).toBe(3)
  })
})

/*
 * FSRS repose une carte neuve dix minutes après, et une carte ratée dans la
 * minute — ce sont ses pas d'apprentissage, et ils sont gardés. Cette seconde vue
 * achève un travail déjà compté : la traiter comme une carte de plus ferait
 * grossir l'objectif du jour à mesure qu'on le remplit, ce qui est exactement
 * l'effet qu'on cherche à supprimer.
 */
describe('repasses du jour', () => {
  /** Une carte vue il y a `minutes`, que FSRS ramène tout de suite. */
  const repeat = (n: number, minutes = 10): DeckEntry => ({
    id: card(n),
    due: new Date(NOW.getTime() - 60_000),
    lastReview: new Date(NOW.getTime() - minutes * 60_000),
  })

  it('les pose, mais hors du quota du jour', () => {
    const plan = planSession([repeat(1), repeat(2)], [card(1), card(2)], NOW, {
      newPerSession: 0,
      today: { planned: 2, introduced: 2 },
    })

    expect(plan.repeats).toBe(2)
    expect(plan.cards).toHaveLength(2)
    // Deux cartes à faire, et pourtant l'objectif reste celui du matin.
    expect(plan.goal).toBe(2)
  })

  it('les pose même quand le budget du jour est épuisé', () => {
    // Rétablir les pas d'apprentissage puis les refuser faute de place laisserait
    // la carte due jusqu'au lendemain : le pire des deux mondes.
    const plan = planSession([repeat(1)], [card(1)], NOW, {
      newPerSession: 0,
      today: { planned: 500, introduced: 10 },
    })

    expect(plan.cards).toEqual([card(1)])
    expect(plan.repeats).toBe(1)
  })

  it('les fait passer en tête', () => {
    // Une carte vue il y a dix minutes se repose maintenant, tant qu'elle est
    // fraîche — c'est tout ce qui justifie la repasse.
    const deck = [repeat(1), { id: card(2), due: ago(3), lastReview: ago(9) }]
    const plan = planSession(deck, [card(1), card(2)], NOW, { newPerSession: 0 })

    expect(plan.cards[0]).toBe(card(1))
  })

  it('ne les compte pas comme du retard', () => {
    // Sinon le rattrapage paraîtrait faire du surplace, et au-delà de soixante
    // repasses l'ouverture de nouveautés se mettrait en pause sans raison.
    const deck = Array.from({ length: BACKLOG_PAUSE + 5 }, (_, index) => repeat(index))
    const plan = planSession(deck, [...deck.map((entry) => entry.id), card(999)], NOW)

    expect(plan.backlog).toBe(0)
    expect(plan.paused).toBe(false)
    expect(plan.introduced).toBe(1)
  })

  it('garde l’objectif stable sur une journée entière, repasses comprises', () => {
    /*
     * Le scénario réel, et celui qui a motivé tout ceci : dix nouveautés, chacune
     * revue une seconde fois dans la journée. L'objectif doit valoir dix du début
     * à la fin — pas dix puis vingt.
     */
    const unlocked = Array.from({ length: 30 }, (_, index) => card(index))

    const morning = planSession([], unlocked, NOW)
    expect(morning.goal).toBe(10)
    expect(morning.repeats).toBe(0)

    const seen = morning.cards.map((id, index) => ({
      id,
      due: new Date(NOW.getTime() - 60_000),
      lastReview: new Date(NOW.getTime() - (10 + index) * 60_000),
    }))
    const later = planSession(seen, unlocked, NOW, { today: { planned: 10, introduced: 10 } })

    expect(later.goal).toBe(10)
    expect(later.repeats).toBe(10)
    expect(later.introduced).toBe(0)
  })

  it('annonce les repasses encore à venir', () => {
    // Dix minutes avant qu'elles ne soient dues, elles n'existent nulle part :
    // l'accueil dirait « séance terminée » à quelqu'un qui va les voir reparaître.
    const soon: DeckEntry = {
      id: card(1),
      due: new Date(NOW.getTime() + 10 * 60_000),
      lastReview: NOW,
    }
    const plan = planSession([soon], [card(1)], NOW, {
      newPerSession: 0,
      today: { planned: 1, introduced: 1 },
    })

    expect(plan.cards).toEqual([])
    expect(plan.repeats).toBe(0)
    expect(plan.pending).toBe(1)
  })

  it('ne compte comme à venir que ce qui revient avant ce soir', () => {
    // Une carte vue aujourd'hui et due dans trois jours est simplement rangée :
    // l'annoncer ferait attendre un retour qui n'aura pas lieu.
    const later: DeckEntry = { id: card(1), due: ahead(3), lastReview: NOW }

    expect(planSession([later], [card(1)], NOW, { newPerSession: 0 }).pending).toBe(0)
  })

  it('ne prend pour repasse que ce qui a été vu aujourd’hui', () => {
    const yesterday: DeckEntry = { id: card(1), due: ago(1), lastReview: ago(1) }
    const plan = planSession([yesterday], [card(1)], NOW, { newPerSession: 0 })

    expect(plan.repeats).toBe(0)
    expect(plan.goal).toBe(1)
  })
})

describe('session ciblée', () => {
  const presente = (n: number) => cardId(`verbe${n}`, 'indicativo.presente')
  const indefinido = (n: number) => cardId(`verbe${n}`, 'indicativo.indefinido')

  it('n’ouvre que les temps visés', () => {
    const deck: DeckEntry[] = [
      { id: presente(1), due: ago(1) },
      { id: indefinido(1), due: ago(1) },
    ]
    const plan = planSession(deck, [presente(1), indefinido(1)], NOW, {
      focus: ['indicativo.indefinido'],
      newPerSession: 0,
    })

    expect(plan.cards).toEqual([indefinido(1)])
    // Le retard affiché est celui de la cible, pas celui du programme entier.
    expect(plan.backlog).toBe(1)
  })

  it('mêle les temps quand la fiche en couvre deux', () => {
    const unlocked = [presente(1), indefinido(1)]
    const plan = planSession([], unlocked, NOW, {
      focus: ['indicativo.presente', 'indicativo.indefinido'],
    })

    expect(new Set(plan.cards)).toEqual(new Set(unlocked))
  })

  /*
   * C'est la règle propre au drill ciblé : on referme une fiche pour l'essayer,
   * et « rien à réviser » ferait du lien une impasse. Une session ordinaire, au
   * contraire, doit s'en tenir aux échéances.
   */
  it('accepte les cartes en avance sur leur échéance', () => {
    const deck: DeckEntry[] = [{ id: indefinido(1), due: ahead(5) }]

    const ordinary = planSession(deck, [indefinido(1)], NOW, { newPerSession: 0 })
    expect(ordinary.cards).toEqual([])
    expect(ordinary.ahead).toBe(0)

    const focused = planSession(deck, [indefinido(1)], NOW, {
      focus: ['indicativo.indefinido'],
      newPerSession: 0,
    })
    expect(focused.cards).toEqual([indefinido(1)])
    expect(focused.ahead).toBe(1)
  })

  it('fait quand même passer les cartes dues devant celles en avance', () => {
    const deck: DeckEntry[] = [
      { id: indefinido(1), due: ahead(2) },
      { id: indefinido(2), due: ago(1) },
      { id: indefinido(3), due: ahead(9) },
    ]
    const plan = planSession(
      deck,
      deck.map((entry) => entry.id),
      NOW,
      { focus: ['indicativo.indefinido'], newPerSession: 0 },
    )

    // Due d'abord, puis les plus proches de leur échéance : ce sont celles dont
    // l'oubli approche, donc celles que réviser en avance coûte le moins.
    expect(plan.cards).toEqual([indefinido(2), indefinido(1), indefinido(3)])
  })

  it('garde son budget entier même quand la journée est faite', () => {
    // Le drill ciblé est un supplément : il ne puise pas dans le quotidien, et
    // réviser en avance ne fait avancer aucune échéance.
    const deck: DeckEntry[] = [{ id: indefinido(1), due: ahead(5) }]
    const plan = planSession(deck, [indefinido(1)], NOW, {
      focus: ['indicativo.indefinido'],
      newPerSession: 0,
      today: { planned: 500, introduced: 0 },
    })

    expect(plan.cards).toEqual([indefinido(1)])
  })

  it('respecte en revanche le plafond de nouveautés du jour', () => {
    // Une carte neuve reste une carte neuve, quel que soit l'endroit d'où on la
    // découvre : sans cela, dix drills ciblés en ouvriraient cent.
    const plan = planSession([], [indefinido(1)], NOW, {
      focus: ['indicativo.indefinido'],
      today: { planned: 0, introduced: 10 },
    })

    expect(plan.cards).toEqual([])
  })

  it('reste courte : on ne relit pas une fiche pour repartir vingt minutes', () => {
    const deck: DeckEntry[] = Array.from({ length: 200 }, (_, index) => ({
      id: indefinido(index),
      due: ago(1),
    }))
    const unlocked = deck.map((entry) => entry.id)

    const focused = planSession(deck, unlocked, NOW, {
      focus: ['indicativo.indefinido'],
      newPerSession: 0,
    })
    const ordinary = planSession(deck, unlocked, NOW, { newPerSession: 0 })

    expect(focused.cards.length).toBeLessThan(ordinary.cards.length)
    expect(focused.cards.length).toBeGreaterThan(0)
  })

  it('ne rend rien quand le programme n’a pas encore ouvert le temps visé', () => {
    // Vide et non « tout est à jour » : l'écran doit pouvoir dire lequel des deux.
    const plan = planSession([], [presente(1)], NOW, { focus: ['subjuntivo.presente'] })
    expect(plan.cards).toEqual([])
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
