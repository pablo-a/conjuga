import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/db'
import { loadSnapshot, loadStudyDays, saveReview, weakPersons } from '@/db/repository'
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

    expect(await loadStudyDays()).toEqual([{ id: DAY, cards: 1, answers: 2 }])
  })

  it('cumule les cartes d’une même journée', async () => {
    // L'écriture a lieu carte par carte : une session de quarante cartes appelle
    // `saveReview` quarante fois, et ne fait pourtant qu'une journée.
    await saveReview({ card: PENSAR, grade: 'good', at: AT, answers: [answer()] })
    await saveReview({ card: HABLAR, grade: 'good', at: AT, answers: [answer(), answer()] })

    expect(await loadStudyDays()).toEqual([{ id: DAY, cards: 2, answers: 3 }])
  })

  it('rend les journées dans l’ordre chronologique', async () => {
    await saveReview({ card: PENSAR, grade: 'good', at: NEXT, answers: [answer()] })
    await saveReview({ card: HABLAR, grade: 'good', at: AT, answers: [answer()] })

    expect((await loadStudyDays()).map((day) => day.id)).toEqual([DAY, dayKey(NEXT)])
  })
})
