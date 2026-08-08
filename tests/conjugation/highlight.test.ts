import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import { segmentsOf } from '@/conjugation/highlight'
import type { Form } from '@/conjugation/types'

/**
 * Le découpage en segments est ce qui transforme un tableau de conjugaison en
 * support d'apprentissage : c'est lui qui met `ie` en couleur dans `pienso`. Il
 * doit donc rester fidèle à la forme — la concaténation des segments est toujours
 * la forme entière, sans quoi l'interface afficherait un mot faux.
 */

const of = (
  infinitive: string,
  ...cell: [Parameters<typeof conjugate>[1], Parameters<typeof conjugate>[2]]
) => conjugate(infinitive, ...cell)!

const rendered = (form: Form) =>
  segmentsOf(form)
    .map((segment) => (segment.irregularities.length > 0 ? `[${segment.text}]` : segment.text))
    .join('')

describe('segmentsOf', () => {
  it('rend une forme régulière d’un seul tenant', () => {
    const segments = segmentsOf(of('hablar', 'indicativo.presente', 'yo'))
    expect(segments).toEqual([{ text: 'hablo', irregularities: [] }])
  })

  it('isole le motif complet de la diphtongaison, pas la seule lettre ajoutée', () => {
    // Entre `penso` et `pienso`, la comparaison brute ne désigne que le `i`. Ce
    // qu'il faut montrer à l'apprenant, c'est `ie`.
    expect(rendered(of('pensar', 'indicativo.presente', 'yo'))).toBe('p[ie]nso')
  })

  it('surligne l’adaptation graphique', () => {
    expect(rendered(of('buscar', 'indicativo.indefinido', 'yo'))).toBe('bus[qu]é')
  })

  it('surligne le radical de prétérit fort avec sa terminaison', () => {
    // Un prétérit fort ne change pas que le radical : ses terminaisons sont
    // atones, `tuve` et non `*tuví`. Le surlignage couvre donc les deux, ce qui
    // est exactement le patron à retenir.
    expect(rendered(of('tener', 'indicativo.indefinido', 'yo'))).toBe('t[uve]')
    expect(rendered(of('decir', 'indicativo.indefinido', 'el'))).toBe('d[ijo]')
  })

  it('surligne la forme entière quand elle est suppletive', () => {
    // `fui` n'a aucun segment commun avec `ió` : montrer un fragment serait
    // trompeur, on montre tout.
    expect(rendered(of('ir', 'indicativo.indefinido', 'yo'))).toBe('[fui]')
  })

  it('ne compte pas l’auxiliaire dans les temps composés', () => {
    // L'irrégularité de `haber` n'est pas celle du verbe conjugué.
    expect(rendered(of('escribir', 'indicativo.perfecto', 'yo'))).toBe('he escri[t]o')
  })

  it('conserve toujours la forme entière', () => {
    const cases: Array<[string, Parameters<typeof conjugate>[1], Parameters<typeof conjugate>[2]]> =
      [
        ['dormir', 'subjuntivo.presente', 'nosotros'],
        ['obtener', 'imperativo.afirmativo', 'tu'],
        ['avergonzar', 'indicativo.presente', 'yo'],
        ['reír', 'indicativo.indefinido', 'el'],
        ['conducir', 'indicativo.indefinido', 'ellos'],
        ['ser', 'indicativo.imperfecto', 'nosotros'],
      ]

    for (const [infinitive, tense, person] of cases) {
      const form = of(infinitive, tense, person)
      const segments = segmentsOf(form)
      expect(segments.map((segment) => segment.text).join(''), infinitive).toBe(form.value)
      // Un segment vide ferait un nœud DOM inutile et une classe appliquée à rien.
      expect(
        segments.every((segment) => segment.text.length > 0),
        infinitive,
      ).toBe(true)
    }
  })

  it('regroupe les irrégularités qui couvrent le même segment', () => {
    const form: Form = {
      value: 'abcde',
      alternatives: [],
      regular: 'axcde',
      irregularities: [
        { kind: 'diphthong', explanation: 'première', span: [1, 3] },
        { kind: 'weakening', explanation: 'seconde', span: [1, 3] },
      ],
    }

    const segments = segmentsOf(form)
    expect(segments.map((segment) => segment.text)).toEqual(['a', 'bc', 'de'])
    expect(segments[1]!.irregularities.map((irregularity) => irregularity.explanation)).toEqual([
      'première',
      'seconde',
    ])
  })

  it('découpe des irrégularités qui se chevauchent partiellement', () => {
    const form: Form = {
      value: 'abcde',
      alternatives: [],
      regular: 'zzzzz',
      irregularities: [
        { kind: 'diphthong', explanation: 'gauche', span: [0, 3] },
        { kind: 'weakening', explanation: 'droite', span: [2, 5] },
      ],
    }

    expect(segmentsOf(form).map((segment) => segment.text)).toEqual(['ab', 'c', 'de'])
  })

  it('ignore des bornes qui déborderaient de la forme', () => {
    const form: Form = {
      value: 'abc',
      alternatives: [],
      regular: 'abcdef',
      irregularities: [{ kind: 'suppletive', explanation: 'trop longue', span: [1, 99] }],
    }

    expect(rendered(form)).toBe('a[bc]')
  })
})
