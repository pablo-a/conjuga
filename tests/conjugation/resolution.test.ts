import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import { resolveModelId } from '@/conjugation/models'

/**
 * Attribution du modèle à un verbe (`resolveModelId`).
 *
 * La cascade — table explicite, familles de suffixe, dérivation préfixée — évite
 * d'énumérer des centaines de dérivés, mais elle raisonne sur la forme écrite du
 * mot. Le risque est donc symétrique :
 *
 *  - rater une parenté réelle (`obtener` conjugué comme un `-er` régulier) ;
 *  - inventer une parenté qui n'existe pas, bien plus grave, car elle produit un
 *    mot faux : `vivir` se termine par `ir` sans être un dérivé du verbe `ir`, et
 *    l'a un temps été conjugué en `voy`.
 *
 * Le premier bloc est le garde-fou contre le second risque.
 */

/** Première personne du présent : c'est là que le modèle se voit le mieux. */
const yo = (infinitive: string) => conjugate(infinitive, 'indicativo.presente', 'yo')?.value

describe('un suffixe qui ressemble à un verbe de base ne suffit pas', () => {
  // Tous réguliers, tous porteurs d'un suffixe qui coïncide avec un verbe irrégulier.
  const regular: Array<[string, string]> = [
    // `viv`, `sub`, `recib`… ne sont pas des préfixes : ce ne sont pas des dérivés de `ir`.
    ['vivir', 'vivo'],
    ['subir', 'subo'],
    ['recibir', 'recibo'],
    ['decidir', 'decido'],
    ['permitir', 'permito'],
    ['partir', 'parto'],
    ['existir', 'existo'],
    ['cumplir', 'cumplo'],
    // Régularité voilée par une simple adaptation graphique, pas par un modèle.
    ['dirigir', 'dirijo'],
    ['distinguir', 'distingo'],
    ['esparcir', 'esparzo'],
    ['delinquir', 'delinco'],
    ['mecer', 'mezo'],
    // Le début se découpe bien en préfixes, mais le verbe n'a jamais été formé
    // sur celui qu'il semble contenir. C'est `NOT_A_DERIVATIVE`.
    ['presentar', 'presento'],
    ['representar', 'represento'],
    ['compensar', 'compenso'],
    ['dispensar', 'dispenso'],
    ['conjugar', 'conjugo'],
    // `estar` n'a aucun dérivé : ces verbes ne doivent rien lui emprunter.
    ['contestar', 'contesto'],
    ['protestar', 'protesto'],
    ['detestar', 'detesto'],
    ['molestar', 'molesto'],
  ]

  it.each(regular)('%s est régulier', (infinitive, expected) => {
    expect(resolveModelId(infinitive)).toBe(null)
    expect(yo(infinitive)).toBe(expected)
  })
})

describe('les dérivés préfixés suivent leur verbe de base', () => {
  const derived: Array<[string, string, string]> = [
    ['obtener', 'tener', 'obtengo'],
    ['mantener', 'tener', 'mantengo'],
    ['entretener', 'tener', 'entretengo'],
    ['sostener', 'tener', 'sostengo'],
    ['componer', 'poner', 'compongo'],
    ['suponer', 'poner', 'supongo'],
    ['oponer', 'poner', 'opongo'],
    // Préfixes composés : `des` + `com`, `pre` + `su`.
    ['descomponer', 'poner', 'descompongo'],
    ['presuponer', 'poner', 'presupongo'],
    ['convenir', 'venir', 'convengo'],
    ['prevenir', 'venir', 'prevengo'],
    ['deshacer', 'hacer', 'deshago'],
    ['contradecir', 'decir', 'contradigo'],
    ['atraer', 'traer', 'atraigo'],
    ['distraer', 'traer', 'distraigo'],
    ['sobresalir', 'salir', 'sobresalgo'],
    ['equivaler', 'valer', 'equivalgo'],
    ['decaer', 'caer', 'decaigo'],
    ['conmover', 'contar', 'conmuevo'],
    ['devolver', 'volver', 'devuelvo'],
    ['envolver', 'volver', 'envuelvo'],
    ['descubrir', 'cubrir', 'descubro'],
    ['consentir', 'sentir', 'consiento'],
    ['presentir', 'sentir', 'presiento'],
    ['despedir', 'pedir', 'despido'],
    ['perseguir', 'pedir', 'persigo'],
    ['encerrar', 'pensar', 'encierro'],
    ['descontar', 'contar', 'descuento'],
    ['sobrevolar', 'contar', 'sobrevuelo'],
    ['comprobar', 'contar', 'compruebo'],
    ['reforzar', 'contar', 'refuerzo'],
    ['descolgar', 'contar', 'descuelgo'],
    ['retorcer', 'contar', 'retuerzo'],
    ['escocer', 'contar', 'escuezo'],
  ]

  it.each(derived)('%s suit %s', (infinitive, base, expected) => {
    expect(resolveModelId(infinitive)).toBe(base)
    expect(yo(infinitive)).toBe(expected)
  })
})

describe('les familles définies par le suffixe', () => {
  const families: Array<[string, string, string]> = [
    ['traducir', 'conducir', 'traduzco'],
    ['producir', 'conducir', 'produzco'],
    ['introducir', 'conducir', 'introduzco'],
    ['deducir', 'conducir', 'deduzco'],
    ['huir', 'construir', 'huyo'],
    ['incluir', 'construir', 'incluyo'],
    ['concluir', 'construir', 'concluyo'],
    ['atribuir', 'construir', 'atribuyo'],
    ['parecer', 'conocer', 'parezco'],
    ['aparecer', 'conocer', 'aparezco'],
    ['crecer', 'conocer', 'crezco'],
    ['merecer', 'conocer', 'merezco'],
    ['reconocer', 'conocer', 'reconozco'],
  ]

  it.each(families)('%s suit %s', (infinitive, model, expected) => {
    expect(resolveModelId(infinitive)).toBe(model)
    expect(yo(infinitive)).toBe(expected)
  })

  it('le u muet de -guir et -quir exclut de la famille des -uir', () => {
    expect(resolveModelId('distinguir')).toBe(null)
    expect(resolveModelId('delinquir')).toBe(null)
    expect(yo('seguir')).toBe('sigo')
  })
})

/**
 * Ces verbes n'ont ni diphtongaison ni changement de radical : le son ne bouge
 * pas. Ce qui change est le découpage en syllabes — `re-ú-no` et non `*reu-no` —
 * et l'accent écrit ne fait que le noter. Rien dans la forme écrite de
 * l'infinitif ne le laisse deviner : `reunir` s'écrit comme `unir`, et
 * `causar` — qui, lui, ne prend jamais d'accent — comme `aunar`. La table
 * explicite est donc le seul recours.
 */
describe('les verbes à hiatus accentué', () => {
  const hiatus: Array<[string, string]> = [
    ['reunir', 'reúno'],
    ['rehusar', 'rehúso'],
    ['aunar', 'aúno'],
    ['prohibir', 'prohíbo'],
    ['aislar', 'aíslo'],
    ['enviar', 'envío'],
    ['actuar', 'actúo'],
  ]

  it.each(hiatus)('%s → %s', (infinitive, expected) => {
    expect(yo(infinitive)).toBe(expected)
  })

  it('laisse intacts les verbes dont les deux voyelles font une seule syllabe', () => {
    // `causar` et `unir` ont exactement la même graphie que `aunar` et `reunir`
    // à l'endroit décisif, et pourtant se conjuguent sans accent.
    expect(yo('causar')).toBe('causo')
    expect(yo('unir')).toBe('uno')
    expect(yo('cambiar')).toBe('cambio')
  })
})
