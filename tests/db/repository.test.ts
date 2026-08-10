import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db'
import { loadDay, loadSnapshot, loadStudyDays, saveReview, weakPersons } from '@/db/repository'
import type { AnswerDraft } from '@/db/repository'
import { cardId } from '@/srs/curriculum'
import { dayKey } from '@/srs/streak'

/**
 * La persistance est testée contre une vraie IndexedDB (`fake-indexeddb`), pas
 * contre un bouchon : ce qu'on veut vérifier — transactions, index, agrégats
 * cumulés — est précisément ce qu'un faux `db` ne reproduirait pas.
 */

const AT = new Date('2026-08-08T09:00:00Z')
const PENSAR = cardId('pensar', 'indicativo.presente')
const HABLAR = cardId('hablar', 'indicativo.presente')

const answer = (over: Partial<AnswerDraft> = {}): AnswerDraft => ({
  person: 'yo',
  kind: 'drill',
  expected: 'pienso',
  given: 'pienso',
  correct: true,
  accentOnly: false,
  elapsedMs: 5000,
  ...over,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('loadSnapshot', () => {
  it('part d’une base vide sans rien inventer', async () => {
    const { deck, progress } = await loadSnapshot()
    expect(deck).toEqual([])
    expect(progress.size).toBe(0)
  })

  it('rend l’échéance au sélecteur et la stabilité au curriculum', async () => {
    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })

    const { deck, progress } = await loadSnapshot()
    expect(deck).toHaveLength(1)
    expect(deck[0]!.id).toBe(PENSAR)
    expect(deck[0]!.due!.getTime()).toBeGreaterThan(AT.getTime())
    // Le curriculum compare la stabilité à un nombre de jours : c'est bien cette
    // grandeur-là qu'il faut lui donner, pas une date.
    expect(progress.get(PENSAR)).toBeGreaterThan(0)
  })
})

describe('saveReview', () => {
  it('crée la carte, ses réponses et son agrégat en une fois', async () => {
    await saveReview({
      card: PENSAR,
      grade: 'good',
      at: AT,
      answers: [answer(), answer({ person: 'nosotros', expected: 'pensamos', given: 'pensamos' })],
    })

    const card = await db.cards.get(PENSAR)
    expect(card).toMatchObject({
      lemma: 'pensar',
      tense: 'indicativo.presente',
      reps: 1,
      lapses: 0,
    })
    expect(await db.answers.count()).toBe(2)

    // Le modèle vient du moteur, pas de la carte : c'est lui qui permet de dire
    // « tu rates les e→ie », et non « tu rates pensar ».
    const stat = await db.patternStats.get('pensar:indicativo.presente')
    expect(stat).toMatchObject({ model: 'pensar', attempts: 2, errors: 0 })
  })

  it('cumule les révisions successives au lieu de les écraser', async () => {
    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })
    await saveReview({
      card: PENSAR,
      grade: 'again',
      at: new Date(AT.getTime() + 86_400_000),
      answers: [answer({ given: 'penso', correct: false })],
    })

    const card = await db.cards.get(PENSAR)
    expect(card!.reps).toBe(2)
    // `again` est un oubli : c'est ce que compte `lapses`, et lui seul.
    expect(card!.lapses).toBe(1)

    const stat = await db.patternStats.get('pensar:indicativo.presente')
    expect(stat).toMatchObject({ attempts: 2, errors: 1 })
  })

  it('ne compte pas la faute d’accent comme un échec du patron', async () => {
    // L'apprenant a appliqué la règle et manqué la syllabe tonique. Le compter
    // ici gonflerait le taux d'échec des modèles accentués et enverrait vers la
    // mauvaise fiche de théorie.
    await saveReview({
      card: PENSAR,
      grade: 'hard',
      at: AT,
      answers: [answer({ given: 'piensó', correct: false, accentOnly: true })],
    })

    const stat = await db.patternStats.get('pensar:indicativo.presente')
    expect(stat).toMatchObject({ attempts: 1, errors: 0 })
  })

  it('rattache un verbe régulier à son modèle de groupe', async () => {
    await saveReview({
      card: HABLAR,
      grade: 'good',
      at: AT,
      answers: [answer({ expected: 'hablo', given: 'hablo' })],
    })

    expect(await db.patternStats.get('regular-ar:indicativo.presente')).toBeDefined()
  })
})

describe('weakPersons', () => {
  it('ne retient qu’une personne encore ratée à sa dernière réponse', async () => {
    // Une personne ratée puis retrouvée n'est plus une faiblesse : la traiter
    // comme telle condamnerait le tirage à repasser toujours sur la même case.
    await saveReview({
      card: PENSAR,
      grade: 'again',
      at: AT,
      answers: [
        answer({ person: 'yo', given: 'penso', correct: false }),
        answer({ person: 'nosotros', given: 'piensamos', correct: false }),
      ],
    })
    await saveReview({
      card: PENSAR,
      grade: 'good',
      at: new Date(AT.getTime() + 86_400_000),
      answers: [answer({ person: 'yo' })],
    })

    const weak = await weakPersons([PENSAR])
    expect(weak.get(PENSAR)).toEqual(['nosotros'])
  })

  it('compte la faute d’accent comme une personne à revoir', async () => {
    // Le SRS la traite doucement, mais l'accent tonique se travaille exactement
    // en reposant la personne concernée.
    await saveReview({
      card: PENSAR,
      grade: 'hard',
      at: AT,
      answers: [answer({ person: 'el', given: 'piensa', correct: false, accentOnly: true })],
    })

    expect((await weakPersons([PENSAR])).get(PENSAR)).toEqual(['el'])
  })

  it('ne rend rien quand on ne demande aucune carte', async () => {
    expect((await weakPersons([])).size).toBe(0)
  })
})

describe('jours travaillés', () => {
  /* Le jour est déduit de l'instant en heure locale : le calculer ici plutôt que
     de l'écrire en dur garde le test juste quel que soit le fuseau. */
  const DAY = dayKey(AT)
  const NEXT = new Date(AT.getTime() + 86_400_000)

  it('ne marque aucun jour tant que rien n’a été révisé', async () => {
    expect(await loadStudyDays()).toEqual([])
  })

  it('marque le jour de la révision, avec ce qu’il a coûté', async () => {
    await saveReview({
      card: PENSAR,
      grade: 'good',
      at: AT,
      answers: [answer(), answer({ person: 'nosotros' })],
    })

    // La carte n'existait pas : elle est une découverte, donc du programme du jour.
    expect(await loadStudyDays()).toEqual([
      { id: DAY, cards: 1, answers: 2, planned: 1, introduced: 1 },
    ])
  })

  it('cumule les cartes d’une même journée', async () => {
    // L'écriture a lieu carte par carte : une session de quarante cartes appelle
    // `saveReview` quarante fois, et ne fait pourtant qu'une journée.
    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })
    await saveReview({ card: HABLAR, grade: 'good', at: AT, answers: [answer(), answer()] })

    expect(await loadStudyDays()).toEqual([
      { id: DAY, cards: 2, answers: 3, planned: 2, introduced: 2 },
    ])
  })

  /*
   * Le budget du jour se dépense ici, et c'est le seul endroit qui sache dans
   * quel état la carte était avant : découverte, due, ou révisée en avance.
   */
  it('ne compte comme découverte que la carte qui n’existait pas', async () => {
    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })
    await saveReview({ card: PENSAR, grade: 'good', at: NEXT, answers: [answer()] })

    const day = (await loadStudyDays()).find((entry) => entry.id === dayKey(NEXT))!
    expect(day).toMatchObject({ planned: 1, introduced: 0 })
  })

  it('ne compte pas deux fois une carte repassée dans la journée', async () => {
    /*
     * FSRS repose une carte neuve dix minutes après : cette seconde vue achève le
     * travail au lieu de s'y ajouter. La compter ferait grossir l'objectif du
     * jour à mesure qu'on le remplit, soit exactement le symptôme qu'on corrige.
     */
    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })
    const back = (await db.cards.get(PENSAR))!.due
    expect(dayKey(back), 'la repasse doit tomber le jour même').toBe(dayKey(AT))

    await saveReview({ card: PENSAR, grade: 'good', at: back, answers: [answer()] })

    const day = (await loadStudyDays()).find((entry) => entry.id === dayKey(AT))!
    expect(day).toMatchObject({ cards: 2, planned: 1, introduced: 1 })
  })

  it('ne fait pas peser sur la journée une carte révisée en avance', async () => {
    // C'est le drill lancé depuis une fiche : un supplément, qui ne fait avancer
    // aucune échéance. Le compter laisserait croire la journée finie alors que
    // les cartes dues attendent toujours.
    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })
    // Sortie des pas d'apprentissage : l'échéance passe à l'échelle du jour.
    await saveReview({
      card: PENSAR,
      grade: 'good',
      at: (await db.cards.get(PENSAR))!.due,
      answers: [answer()],
    })

    const early = NEXT
    expect((await db.cards.get(PENSAR))!.due.getTime()).toBeGreaterThan(early.getTime())
    await saveReview({ card: PENSAR, grade: 'good', at: early, answers: [answer()] })

    const day = (await loadStudyDays()).find((entry) => entry.id === dayKey(early))!
    expect(day).toMatchObject({ cards: 1, planned: 0, introduced: 0 })
  })

  it('rend une journée vierge plutôt qu’une absence de réponse', async () => {
    // Le sélecteur en soustrait les compteurs : un `undefined` n'y donnerait pas
    // zéro mais `NaN`, et la séance du jour disparaîtrait.
    expect(await loadDay(AT)).toEqual({ id: DAY, cards: 0, answers: 0, planned: 0, introduced: 0 })

    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })
    expect(await loadDay(AT)).toMatchObject({ planned: 1, introduced: 1 })
  })

  it('rend les journées dans l’ordre chronologique', async () => {
    await saveReview({ card: PENSAR, grade: 'good', at: NEXT, answers: [answer()] })
    await saveReview({ card: HABLAR, grade: 'good', at: AT, answers: [answer()] })

    expect((await loadStudyDays()).map((day) => day.id)).toEqual([DAY, dayKey(NEXT)])
  })
})

/**
 * La migration n'est pas cosmétique : `kind` décide de ce qui compte comme preuve
 * de production. Laisser les lignes d'avant sans valeur les ferait lire, tôt ou
 * tard, comme « pas une production » — et effacerait l'historique de qui a le
 * plus travaillé.
 */
describe('passage à la version 3', () => {
  it('marque comme production tout ce qui était rangé avant la reconnaissance', async () => {
    await db.close()
    await db.delete()

    // Une base telle que la version 2 la laissait : aucune réponse ne porte de
    // format, puisqu'il n'y en avait qu'un.
    const before = new Dexie('conjuga')
    before.version(1).stores({
      cards: 'id, lemma, tense, due',
      answers: '++id, cardId, answeredAt',
      patternStats: 'id, model, tense',
    })
    before.version(2).stores({ days: 'id' })
    await before.open()
    await before.table('answers').add({
      cardId: PENSAR,
      answeredAt: AT,
      person: 'yo',
      expected: 'pienso',
      given: 'penso',
      correct: false,
      accentOnly: false,
      elapsedMs: 5000,
    })
    before.close()

    await db.open()

    const stored = await db.answers.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.kind).toBe('drill')
    // Et la faiblesse qu'elle portait est toujours lue comme telle.
    expect((await weakPersons([PENSAR])).get(PENSAR)).toEqual(['yo'])
  })
})

/**
 * Les compteurs de la journée entrent dans des soustractions. Les laisser absents
 * ne donnerait pas « zéro » mais `NaN` : une base d'avant la mise à jour n'aurait
 * plus de séance du jour du tout, et l'accueil afficherait un objectif indéfini.
 */
describe('passage à la version 4', () => {
  it('donne un programme aux journées déjà enregistrées', async () => {
    await db.close()
    await db.delete()

    const before = new Dexie('conjuga')
    before.version(1).stores({
      cards: 'id, lemma, tense, due',
      answers: '++id, cardId, answeredAt',
      patternStats: 'id, model, tense',
    })
    before.version(2).stores({ days: 'id' })
    await before.open()
    await before.table('answers').bulkAdd([
      {
        cardId: PENSAR,
        answeredAt: AT,
        person: 'yo',
        kind: 'drill',
        expected: 'pienso',
        given: 'pienso',
        correct: true,
        accentOnly: false,
        elapsedMs: 5000,
      },
      {
        cardId: HABLAR,
        answeredAt: AT,
        person: 'yo',
        kind: 'drill',
        expected: 'hablo',
        given: 'hablo',
        correct: true,
        accentOnly: false,
        elapsedMs: 5000,
      },
      // Une deuxième réponse sur une carte déjà vue : la découverte ne compte
      // qu'une fois, le jour où elle a eu lieu.
      {
        cardId: PENSAR,
        answeredAt: new Date(AT.getTime() + 86_400_000),
        person: 'tu',
        kind: 'drill',
        expected: 'piensas',
        given: 'piensas',
        correct: true,
        accentOnly: false,
        elapsedMs: 5000,
      },
    ])
    await before.table('days').bulkAdd([
      { id: dayKey(AT), cards: 2, answers: 2 },
      { id: dayKey(new Date(AT.getTime() + 86_400_000)), cards: 1, answers: 1 },
    ])
    before.close()

    await db.open()

    expect(await loadStudyDays()).toEqual([
      { id: dayKey(AT), cards: 2, answers: 2, planned: 2, introduced: 2 },
      {
        id: dayKey(new Date(AT.getTime() + 86_400_000)),
        cards: 1,
        answers: 1,
        planned: 1,
        introduced: 0,
      },
    ])
  })
})
