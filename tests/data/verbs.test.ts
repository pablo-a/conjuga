import { describe, expect, it } from 'vitest'

import verbs from '@/data/verbs.json'
import { conjugate, nonFinite, resolveModelId } from '@/conjugation'
import { SIMPLE_TENSES, PERSONS } from '@/conjugation/types'

/**
 * `src/data/verbs.json` est **généré** par `npm run data:verbs`, mais il est
 * versionné et livré : il mérite donc les mêmes garanties que du code écrit à la
 * main. Ces tests ne jugent pas la pertinence du classement — c'est l'affaire de
 * la relecture humaine, `data/verbs-review.md` — mais son intégrité.
 *
 * Le garde-fou qui compte est celui du modèle : si quelqu'un enrichit
 * `VERB_MODELS` sans régénérer la liste, `verbs.json` désigne un modèle périmé et
 * l'app enseignerait une conjugaison que le moteur ne produit plus.
 */

interface VerbRecord {
  es: string
  fr: string[]
  rank: number
  model: string | null
  frequency: number
  reviewed: boolean
}

const list = verbs as VerbRecord[]

describe('src/data/verbs.json', () => {
  it('contient les 1000 verbes attendus', () => {
    expect(list).toHaveLength(1000)
  })

  it('numérote les rangs de 1 à N, sans trou ni doublon', () => {
    expect(list.map((verb) => verb.rank)).toEqual(list.map((_, index) => index + 1))
  })

  it('ne répète aucun verbe', () => {
    const seen = new Set(list.map((verb) => verb.es))
    expect(seen.size).toBe(list.length)
  })

  it('classe par fréquence décroissante', () => {
    for (let index = 1; index < list.length; index++) {
      expect(list[index]!.frequency, list[index]!.es).toBeLessThanOrEqual(
        list[index - 1]!.frequency,
      )
    }
  })

  it('donne au moins une traduction à chaque verbe', () => {
    const missing = list.filter((verb) => verb.fr.length === 0 || verb.fr[0]!.trim().length === 0)
    expect(missing.map((verb) => verb.es)).toEqual([])
  })

  it('reste cohérent avec le moteur sur l’attribution des modèles', () => {
    // Régénérer la liste (`npm run data:verbs`) est le correctif attendu si ce
    // test tombe après un ajout dans `VERB_MODELS`.
    const stale = list
      .filter((verb) => verb.model !== resolveModelId(verb.es))
      .map((verb) => `${verb.es} : ${verb.model} ≠ ${resolveModelId(verb.es)}`)

    expect(stale).toEqual([])
  })

  it('conjugue sans exception, à toutes les cases', () => {
    const broken: string[] = []
    for (const verb of list) {
      try {
        nonFinite(verb.es)
        for (const tense of SIMPLE_TENSES) {
          for (const person of PERSONS) conjugate(verb.es, tense, person)
        }
      } catch (error) {
        broken.push(`${verb.es} : ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('respecte le schéma sur chaque entrée', () => {
    // Un fichier généré n'est pas relu ligne à ligne : c'est ici qu'on vérifie
    // qu'aucune entrée n'est partielle ou mal typée.
    const malformed = list.filter(
      (verb) =>
        typeof verb.es !== 'string' ||
        verb.es.length === 0 ||
        !Array.isArray(verb.fr) ||
        verb.fr.some((gloss) => typeof gloss !== 'string') ||
        !Number.isInteger(verb.rank) ||
        !Number.isFinite(verb.frequency) ||
        verb.frequency <= 0 ||
        typeof verb.reviewed !== 'boolean' ||
        (verb.model !== null && typeof verb.model !== 'string'),
    )
    expect(malformed.map((verb) => verb.es)).toEqual([])
  })

  it('couvre bien les verbes que tout apprenant rencontre en premier', () => {
    const essential = ['ser', 'estar', 'tener', 'haber', 'ir', 'hacer', 'poder', 'decir', 'ver']
    const top = new Set(list.slice(0, 15).map((verb) => verb.es))
    for (const verb of essential) expect(top.has(verb), verb).toBe(true)
  })
})
