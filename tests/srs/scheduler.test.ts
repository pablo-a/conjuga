import { describe, expect, it } from 'vitest'

import { applyReview, isDue, newCardState, preview, rateReview } from '@/srs/scheduler'
import type { QuestionOutcome } from '@/srs/scheduler'

/**
 * L'algorithme FSRS lui-même n'est pas retesté ici : c'est la responsabilité de
 * `ts-fsrs`. Ce qui est vérifié, c'est notre traduction — comment 2 ou 3 réponses
 * deviennent une note, et que l'état d'une carte progresse comme on l'attend.
 */

const AT = new Date('2026-08-08T09:00:00Z')
const correct = (elapsedMs = 6000): QuestionOutcome => ({ verdict: 'correct', elapsedMs })
const accent = (elapsedMs = 6000): QuestionOutcome => ({ verdict: 'accent', elapsedMs })
const wrong = (elapsedMs = 6000): QuestionOutcome => ({ verdict: 'wrong', elapsedMs })

describe('rateReview', () => {
  it('échoue la carte dès qu’une forme est fausse', () => {
    // Savoir un verbe à quatre personnes sur six, ce n'est pas le savoir : la
    // carte porte le couple (verbe, temps) tout entier.
    expect(rateReview([correct(), correct(), wrong()])).toBe('again')
    expect(rateReview([wrong(), correct()])).toBe('again')
  })

  it('classe la faute d’accent comme fragile, pas comme échec', () => {
    expect(rateReview([correct(), accent()])).toBe('hard')
    expect(rateReview([accent()])).toBe('hard')
  })

  it('fait passer l’erreur de forme avant la faute d’accent', () => {
    expect(rateReview([accent(), wrong()])).toBe('again')
  })

  it('distingue la forme sue de la forme reconstruite', () => {
    // Répondre vite, c'est ne pas avoir eu à dérouler la conjugaison.
    expect(rateReview([correct(1200), correct(900)])).toBe('easy')
    expect(rateReview([correct(1200), correct(9000)])).toBe('good')
  })

  it('ne considère jamais une révision vide comme réussie', () => {
    expect(rateReview([])).toBe('again')
  })
})

describe('cycle de vie d’une carte', () => {
  it('crée une carte due immédiatement', () => {
    const fresh = newCardState(AT)
    expect(isDue(fresh, AT)).toBe(true)
    expect(fresh.reps).toBe(0)
  })

  it('repousse l’échéance à mesure des succès', () => {
    let state = newCardState(AT)
    let previous = AT

    for (let review = 0; review < 5; review++) {
      const result = applyReview(state, 'good', previous)
      expect(result.due.getTime(), `révision ${review + 1}`).toBeGreaterThan(previous.getTime())
      state = result.state
      previous = result.due
    }
    expect(state.reps).toBe(5)
  })

  it('ramène une carte ratée et compte l’oubli', () => {
    const learned = applyReview(applyReview(newCardState(AT), 'easy', AT).state, 'easy', AT)
    const lapsed = applyReview(learned.state, 'again', learned.due)

    expect(lapsed.due.getTime() - learned.due.getTime()).toBeLessThan(
      learned.due.getTime() - AT.getTime(),
    )
    expect(lapsed.state.lapses).toBe(1)
  })

  it('ordonne les intervalles du plus court au plus long', () => {
    // Un `easy` ne doit jamais ramener la carte plus tôt qu'un `good`, sans quoi
    // répondre juste et vite serait puni.
    const state = applyReview(newCardState(AT), 'good', AT).state
    const at = new Date(AT.getTime() + 86_400_000)
    const { again, hard, good, easy } = preview(state, at)

    expect(again.getTime()).toBeLessThanOrEqual(hard.getTime())
    expect(hard.getTime()).toBeLessThanOrEqual(good.getTime())
    expect(good.getTime()).toBeLessThanOrEqual(easy.getTime())
  })

  it('repose une carte neuve le jour même, avant de l’espacer', () => {
    /*
     * Les pas d'apprentissage sont **gardés**, et ce test les épingle : ils ont
     * été coupés un temps, et les rétablir sans le dire les exposerait à être
     * recoupés au premier compteur qui paraîtra bizarre. Toute la comptabilité de
     * la journée est bâtie sur ce comportement — voir `SessionPlan.repeats`.
     */
    const sameDay = AT.getTime() + 86_400_000
    for (const grade of ['again', 'good'] as const) {
      const first = applyReview(newCardState(AT), grade, AT)
      expect(first.due.getTime(), `carte neuve, ${grade}`).toBeLessThan(sameDay)
    }

    // La reprise, elle, espace pour de bon : le pas d'apprentissage ne se répète
    // pas indéfiniment.
    const learned = applyReview(newCardState(AT), 'good', AT)
    const graduated = applyReview(learned.state, 'good', learned.due)
    expect(graduated.due.getTime() - learned.due.getTime()).toBeGreaterThan(86_400_000)
  })

  it('ne modifie pas la carte quand on ne fait que prévoir', () => {
    const state = newCardState(AT)
    const before = JSON.stringify(state)
    preview(state, AT)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('est déterministe : deux fois la même note donnent la même échéance', () => {
    // Le flou de FSRS est désactivé. Sans cela, l'ordonnancement serait
    // intestable et une régression passerait inaperçue.
    const state = newCardState(AT)
    const first = applyReview(state, 'good', AT)
    const second = applyReview(state, 'good', AT)
    expect(first.due.toISOString()).toBe(second.due.toISOString())
  })
})
