import { describe, expect, it } from 'vitest'

import { dayKey, streakLength } from '@/srs/streak'

/**
 * Les dates sont construites en heure **locale** (`new Date(2026, 7, 8)`), jamais
 * depuis une chaîne ISO : c'est le calendrier de l'apprenant que la série suit, et
 * un test écrit en UTC passerait ou non selon le fuseau de la machine.
 */
const local = (year: number, month: number, day: number, hour = 12): Date =>
  new Date(year, month - 1, day, hour)

describe('dayKey', () => {
  it('rend le jour civil local, complété à deux chiffres', () => {
    expect(dayKey(local(2026, 8, 8))).toBe('2026-08-08')
    expect(dayKey(local(2026, 12, 31))).toBe('2026-12-31')
  })

  it('range une session de fin de soirée dans sa propre journée', () => {
    // À 23 h 30 à Paris on est déjà le lendemain en UTC : dater la révision en
    // UTC casserait la série de quelqu'un qui révise tard deux soirs de suite.
    expect(dayKey(local(2026, 8, 8, 23))).toBe('2026-08-08')
    expect(dayKey(local(2026, 8, 8, 0))).toBe('2026-08-08')
  })
})

describe('streakLength', () => {
  const today = local(2026, 8, 8)

  it('ne compte rien quand rien n’a jamais été révisé', () => {
    expect(streakLength([], today)).toBe(0)
  })

  it('compte les jours consécutifs jusqu’à aujourd’hui', () => {
    expect(streakLength(['2026-08-06', '2026-08-07', '2026-08-08'], today)).toBe(3)
  })

  it('ne casse pas la série tant que la journée n’est pas finie', () => {
    // Rien fait aujourd'hui, mais la journée n'est pas écoulée : afficher zéro
    // le matin punirait quelqu'un qui n'a rien fait de mal.
    expect(streakLength(['2026-08-06', '2026-08-07'], today)).toBe(2)
  })

  it('rompt la série au premier jour manqué', () => {
    // Avant-hier et rien depuis : hier est passé sans session, c'est fini.
    expect(streakLength(['2026-08-05', '2026-08-06'], today)).toBe(0)
  })

  it('ignore ce qui précède le trou', () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-07', '2026-08-08']
    expect(streakLength(days, today)).toBe(2)
  })

  it('traverse un changement de mois', () => {
    expect(streakLength(['2026-07-31', '2026-08-01'], local(2026, 8, 1))).toBe(2)
  })

  it('traverse un 29 février', () => {
    expect(streakLength(['2028-02-28', '2028-02-29', '2028-03-01'], local(2028, 3, 1))).toBe(3)
  })

  it('se moque de l’ordre et des doublons', () => {
    // La table des jours est une clé primaire, mais rien n'oblige l'appelant à la
    // trier : la série est une propriété de l'ensemble, pas de la liste.
    expect(streakLength(['2026-08-08', '2026-08-06', '2026-08-07', '2026-08-08'], today)).toBe(3)
  })
})
