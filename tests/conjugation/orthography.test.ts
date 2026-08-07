import { describe, expect, it } from 'vitest'

import { conjugate, conjugateAll, nonFinite } from '@/conjugation'
import type { Person, Tense } from '@/conjugation/types'

const at = (infinitive: string, tense: Tense, person: Person) =>
  conjugate(infinitive, tense, person)?.value ?? null

/**
 * Ces verbes sont réguliers à l'oral : leur radical ne change pas de son. Seule
 * l'écriture s'adapte pour le conserver devant une voyelle de l'autre série.
 * C'est la famille d'irrégularités la plus facile à enseigner — à condition de
 * l'expliquer comme une règle de son, et pas comme une liste à retenir.
 */
describe('verbes en -ar : le radical se protège devant e', () => {
  it('-car → qu (buscar)', () => {
    expect(at('buscar', 'indicativo.indefinido', 'yo')).toBe('busqué')
    expect(at('buscar', 'subjuntivo.presente', 'yo')).toBe('busque')
    // Devant a et o, rien ne change : le son est déjà celui de l'infinitif.
    expect(at('buscar', 'indicativo.presente', 'yo')).toBe('busco')
    expect(at('buscar', 'indicativo.indefinido', 'el')).toBe('buscó')
  })

  it('-gar → gu (llegar)', () => {
    expect(at('llegar', 'indicativo.indefinido', 'yo')).toBe('llegué')
    expect(at('llegar', 'subjuntivo.presente', 'nosotros')).toBe('lleguemos')
    expect(at('llegar', 'indicativo.presente', 'yo')).toBe('llego')
  })

  it('-zar → c (cruzar)', () => {
    expect(at('cruzar', 'indicativo.indefinido', 'yo')).toBe('crucé')
    expect(at('cruzar', 'subjuntivo.presente', 'ellos')).toBe('crucen')
    expect(at('cruzar', 'indicativo.presente', 'yo')).toBe('cruzo')
  })

  it('-guar → gü (averiguar)', () => {
    // Le tréma est indispensable : sans lui le u cesserait d'être prononcé.
    expect(at('averiguar', 'indicativo.indefinido', 'yo')).toBe('averigüé')
    expect(at('averiguar', 'subjuntivo.presente', 'yo')).toBe('averigüe')
    expect(at('averiguar', 'indicativo.presente', 'yo')).toBe('averiguo')
  })
})

describe('verbes en -er et -ir : le radical se protège devant a et o', () => {
  it('-ger → j (coger)', () => {
    expect(at('coger', 'indicativo.presente', 'yo')).toBe('cojo')
    expect(at('coger', 'subjuntivo.presente', 'yo')).toBe('coja')
    expect(at('coger', 'indicativo.presente', 'tu')).toBe('coges')
  })

  it('-gir → j (dirigir)', () => {
    expect(at('dirigir', 'indicativo.presente', 'yo')).toBe('dirijo')
    expect(at('dirigir', 'subjuntivo.presente', 'nosotros')).toBe('dirijamos')
    expect(at('dirigir', 'indicativo.presente', 'el')).toBe('dirige')
  })

  it('-guir → g (distinguir)', () => {
    expect(at('distinguir', 'indicativo.presente', 'yo')).toBe('distingo')
    expect(at('distinguir', 'subjuntivo.presente', 'yo')).toBe('distinga')
    expect(at('distinguir', 'indicativo.presente', 'tu')).toBe('distingues')
    // Le u de -guir est muet : il ne déclenche jamais la règle du i intervocalique.
    expect(at('distinguir', 'indicativo.indefinido', 'el')).toBe('distinguió')
  })

  it('-cer après consonne → z (vencer)', () => {
    expect(at('vencer', 'indicativo.presente', 'yo')).toBe('venzo')
    expect(at('vencer', 'subjuntivo.presente', 'ellos')).toBe('venzan')
    expect(at('vencer', 'indicativo.presente', 'tu')).toBe('vences')
  })

  it('-cir après consonne → z (esparcir)', () => {
    expect(at('esparcir', 'indicativo.presente', 'yo')).toBe('esparzo')
    expect(at('esparcir', 'subjuntivo.presente', 'yo')).toBe('esparza')
  })

  it('-quir → c (delinquir)', () => {
    expect(at('delinquir', 'indicativo.presente', 'yo')).toBe('delinco')
    expect(at('delinquir', 'subjuntivo.presente', 'yo')).toBe('delinca')
  })
})

describe('le i des terminaisons entre deux voyelles devient y', () => {
  it('leer', () => {
    expect(at('leer', 'indicativo.indefinido', 'el')).toBe('leyó')
    expect(at('leer', 'indicativo.indefinido', 'ellos')).toBe('leyeron')
    expect(at('leer', 'subjuntivo.imperfecto', 'yo')).toBe('leyera')
    expect(nonFinite('leer').gerundio).toBe('leyendo')
    // Les autres personnes du prétérit gardent le i : il n'y est pas intervocalique.
    expect(at('leer', 'indicativo.indefinido', 'yo')).toBe('leí')
    expect(at('leer', 'indicativo.indefinido', 'tu')).toBe('leíste')
  })

  it('creer et poseer', () => {
    expect(at('creer', 'indicativo.indefinido', 'el')).toBe('creyó')
    expect(nonFinite('creer').gerundio).toBe('creyendo')
    expect(at('poseer', 'indicativo.indefinido', 'ellos')).toBe('poseyeron')
  })
})

describe('le i disparaît après ñ, ll et ch', () => {
  it('bullir', () => {
    expect(at('bullir', 'indicativo.indefinido', 'el')).toBe('bulló')
    expect(at('bullir', 'indicativo.indefinido', 'ellos')).toBe('bulleron')
    expect(nonFinite('bullir').gerundio).toBe('bullendo')
  })

  it('tañer', () => {
    expect(at('tañer', 'indicativo.indefinido', 'el')).toBe('tañó')
    expect(at('tañer', 'subjuntivo.imperfecto', 'yo')).toBe('tañera')
  })
})

describe('accentuation du participe après voyelle forte', () => {
  it('prend un accent sur le i', () => {
    expect(nonFinite('leer').participio).toBe('leído')
    expect(nonFinite('creer').participio).toBe('creído')
    expect(nonFinite('traer').participio).toBe('traído')
  })

  it('ne l’ajoute pas après un u, qui reste une voyelle faible', () => {
    expect(nonFinite('construir').participio).toBe('construido')
    expect(nonFinite('huir').participio).toBe('huido')
  })
})

describe('signalement des irrégularités orthographiques', () => {
  it('marque le changement et le localise', () => {
    const form = conjugate('buscar', 'indicativo.indefinido', 'yo')
    expect(form?.value).toBe('busqué')
    expect(form?.regular).toBe('buscé')

    const orthographic = form?.irregularities.find((item) => item.kind === 'orthographic')
    expect(orthographic).toBeDefined()
    // Le segment surligné est le `qu` qui remplace le `c`.
    const [start, end] = orthographic!.span
    expect(form!.value.slice(start, end)).toBe('qu')
  })

  it('ne signale rien quand l’écriture ne bouge pas', () => {
    for (const form of conjugateAll('buscar', 'indicativo.presente')) {
      expect(form?.irregularities).toEqual([])
    }
  })
})
