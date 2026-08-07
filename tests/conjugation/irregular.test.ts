import { describe, expect, it } from 'vitest'

import { conjugate, conjugateAll, nonFinite } from '@/conjugation'
import type { Person, Tense } from '@/conjugation/types'

const formsOf = (infinitive: string, tense: Tense) =>
  conjugateAll(infinitive, tense).map((form) => form?.value ?? null)

const at = (infinitive: string, tense: Tense, person: Person) =>
  conjugate(infinitive, tense, person)?.value ?? null

/**
 * Chaque bloc vérifie une *famille*, pas un verbe : c'est la famille qu'on
 * enseignera, et c'est donc elle qui doit être juste. Les tables sont écrites à
 * la main et ne sont dérivées d'aucun code.
 */
describe('diphtongaison sous l’accent tonique', () => {
  it('pensar — e → ie', () => {
    expect(formsOf('pensar', 'indicativo.presente')).toEqual([
      'pienso',
      'piensas',
      'piensa',
      'pensamos',
      'pensáis',
      'piensan',
    ])
    // Nosotros et vosotros ne diphtonguent pas : l'accent tonique n'y tombe pas
    // sur le radical. C'est la clé de toute la famille.
    expect(formsOf('pensar', 'subjuntivo.presente')).toEqual([
      'piense',
      'pienses',
      'piense',
      'pensemos',
      'penséis',
      'piensen',
    ])
    expect(formsOf('pensar', 'imperativo.afirmativo')).toEqual([
      null,
      'piensa',
      'piense',
      'pensemos',
      'pensad',
      'piensen',
    ])
    // Le prétérit et l'imparfait ignorent la diphtongaison.
    expect(at('pensar', 'indicativo.indefinido', 'yo')).toBe('pensé')
    expect(at('pensar', 'indicativo.imperfecto', 'yo')).toBe('pensaba')
  })

  it('contar — o → ue', () => {
    expect(formsOf('contar', 'indicativo.presente')).toEqual([
      'cuento',
      'cuentas',
      'cuenta',
      'contamos',
      'contáis',
      'cuentan',
    ])
    expect(formsOf('contar', 'subjuntivo.presente')).toEqual([
      'cuente',
      'cuentes',
      'cuente',
      'contemos',
      'contéis',
      'cuenten',
    ])
  })

  it('jugar — u → ue, avec la protection graphique du g', () => {
    expect(formsOf('jugar', 'indicativo.presente')).toEqual([
      'juego',
      'juegas',
      'juega',
      'jugamos',
      'jugáis',
      'juegan',
    ])
    // Diphtongaison et règle du -gar se combinent : juegue, mais juguemos.
    expect(formsOf('jugar', 'subjuntivo.presente')).toEqual([
      'juegue',
      'juegues',
      'juegue',
      'juguemos',
      'juguéis',
      'jueguen',
    ])
    expect(at('jugar', 'indicativo.indefinido', 'yo')).toBe('jugué')
  })

  it('empezar — diphtongaison et règle du -zar', () => {
    expect(at('empezar', 'indicativo.presente', 'yo')).toBe('empiezo')
    expect(at('empezar', 'subjuntivo.presente', 'yo')).toBe('empiece')
    expect(at('empezar', 'subjuntivo.presente', 'nosotros')).toBe('empecemos')
    expect(at('empezar', 'indicativo.indefinido', 'yo')).toBe('empecé')
  })

  it('perder et volver — la famille traverse les trois groupes', () => {
    expect(at('perder', 'indicativo.presente', 'yo')).toBe('pierdo')
    expect(at('perder', 'subjuntivo.presente', 'nosotros')).toBe('perdamos')
    expect(at('volver', 'indicativo.presente', 'yo')).toBe('vuelvo')
    expect(nonFinite('volver').participio).toBe('vuelto')
  })
})

describe('verbes en -ir à double alternance', () => {
  it('sentir — ie sous l’accent, i devant les terminaisons en i atone', () => {
    expect(formsOf('sentir', 'indicativo.presente')).toEqual([
      'siento',
      'sientes',
      'siente',
      'sentimos',
      'sentís',
      'sienten',
    ])
    expect(formsOf('sentir', 'subjuntivo.presente')).toEqual([
      'sienta',
      'sientas',
      'sienta',
      'sintamos',
      'sintáis',
      'sientan',
    ])
    expect(formsOf('sentir', 'indicativo.indefinido')).toEqual([
      'sentí',
      'sentiste',
      'sintió',
      'sentimos',
      'sentisteis',
      'sintieron',
    ])
    expect(nonFinite('sentir').gerundio).toBe('sintiendo')
    // Le subjonctif imparfait suit la troisième personne du pluriel du prétérit.
    expect(at('sentir', 'subjuntivo.imperfecto', 'yo')).toBe('sintiera')
  })

  it('dormir — ue sous l’accent, u ailleurs', () => {
    expect(formsOf('dormir', 'indicativo.presente')).toEqual([
      'duermo',
      'duermes',
      'duerme',
      'dormimos',
      'dormís',
      'duermen',
    ])
    expect(formsOf('dormir', 'subjuntivo.presente')).toEqual([
      'duerma',
      'duermas',
      'duerma',
      'durmamos',
      'durmáis',
      'duerman',
    ])
    expect(at('dormir', 'indicativo.indefinido', 'el')).toBe('durmió')
    expect(at('dormir', 'indicativo.indefinido', 'ellos')).toBe('durmieron')
    expect(nonFinite('dormir').gerundio).toBe('durmiendo')
  })

  it('morir — même alternance, participe irrégulier', () => {
    expect(at('morir', 'indicativo.presente', 'yo')).toBe('muero')
    expect(at('morir', 'indicativo.indefinido', 'el')).toBe('murió')
    expect(nonFinite('morir').participio).toBe('muerto')
  })
})

describe('affaiblissement pur des -ir', () => {
  it('pedir — i partout où le radical est concerné', () => {
    expect(formsOf('pedir', 'indicativo.presente')).toEqual([
      'pido',
      'pides',
      'pide',
      'pedimos',
      'pedís',
      'piden',
    ])
    // Contrairement à sentir, le subjonctif est uniforme : pas de retour à e.
    expect(formsOf('pedir', 'subjuntivo.presente')).toEqual([
      'pida',
      'pidas',
      'pida',
      'pidamos',
      'pidáis',
      'pidan',
    ])
    expect(at('pedir', 'indicativo.indefinido', 'el')).toBe('pidió')
    expect(nonFinite('pedir').gerundio).toBe('pidiendo')
  })

  it('seguir — affaiblissement et chute du u muet', () => {
    expect(formsOf('seguir', 'indicativo.presente')).toEqual([
      'sigo',
      'sigues',
      'sigue',
      'seguimos',
      'seguís',
      'siguen',
    ])
    expect(formsOf('seguir', 'subjuntivo.presente')).toEqual([
      'siga',
      'sigas',
      'siga',
      'sigamos',
      'sigáis',
      'sigan',
    ])
    expect(at('seguir', 'indicativo.indefinido', 'el')).toBe('siguió')
    expect(nonFinite('seguir').gerundio).toBe('siguiendo')
  })
})

describe('incohatifs en -zc', () => {
  it('conocer', () => {
    expect(formsOf('conocer', 'indicativo.presente')).toEqual([
      'conozco',
      'conoces',
      'conoce',
      'conocemos',
      'conocéis',
      'conocen',
    ])
    // Tout le subjonctif hérite de la première personne : c'est la règle générale.
    expect(formsOf('conocer', 'subjuntivo.presente')).toEqual([
      'conozca',
      'conozcas',
      'conozca',
      'conozcamos',
      'conozcáis',
      'conozcan',
    ])
  })

  it('conducir — zc au présent, prétérit fort en -duj-', () => {
    expect(at('conducir', 'indicativo.presente', 'yo')).toBe('conduzco')
    expect(formsOf('conducir', 'indicativo.indefinido')).toEqual([
      'conduje',
      'condujiste',
      'condujo',
      'condujimos',
      'condujisteis',
      'condujeron',
    ])
  })
})

describe('verbes en -uir', () => {
  it('construir intercale un y', () => {
    expect(formsOf('construir', 'indicativo.presente')).toEqual([
      'construyo',
      'construyes',
      'construye',
      'construimos',
      'construís',
      'construyen',
    ])
    expect(at('construir', 'subjuntivo.presente', 'nosotros')).toBe('construyamos')
    expect(at('construir', 'indicativo.indefinido', 'el')).toBe('construyó')
    expect(nonFinite('construir').gerundio).toBe('construyendo')
  })
})

describe('accentuation du radical en -iar et -uar', () => {
  it('enviar', () => {
    expect(formsOf('enviar', 'indicativo.presente')).toEqual([
      'envío',
      'envías',
      'envía',
      'enviamos',
      'enviáis',
      'envían',
    ])
    expect(at('enviar', 'subjuntivo.presente', 'nosotros')).toBe('enviemos')
  })

  it('actuar', () => {
    expect(formsOf('actuar', 'indicativo.presente')).toEqual([
      'actúo',
      'actúas',
      'actúa',
      'actuamos',
      'actuáis',
      'actúan',
    ])
  })
})

describe('prétérits forts et futurs syncopés', () => {
  it('tener', () => {
    expect(formsOf('tener', 'indicativo.presente')).toEqual([
      'tengo',
      'tienes',
      'tiene',
      'tenemos',
      'tenéis',
      'tienen',
    ])
    expect(formsOf('tener', 'subjuntivo.presente')).toEqual([
      'tenga',
      'tengas',
      'tenga',
      'tengamos',
      'tengáis',
      'tengan',
    ])
    expect(formsOf('tener', 'indicativo.indefinido')).toEqual([
      'tuve',
      'tuviste',
      'tuvo',
      'tuvimos',
      'tuvisteis',
      'tuvieron',
    ])
    expect(formsOf('tener', 'indicativo.futuro')).toEqual([
      'tendré',
      'tendrás',
      'tendrá',
      'tendremos',
      'tendréis',
      'tendrán',
    ])
    expect(at('tener', 'indicativo.condicional', 'yo')).toBe('tendría')
    expect(at('tener', 'subjuntivo.imperfecto', 'yo')).toBe('tuviera')
    expect(formsOf('tener', 'imperativo.afirmativo')).toEqual([
      null,
      'ten',
      'tenga',
      'tengamos',
      'tened',
      'tengan',
    ])
  })

  it('venir', () => {
    expect(formsOf('venir', 'indicativo.presente')).toEqual([
      'vengo',
      'vienes',
      'viene',
      'venimos',
      'venís',
      'vienen',
    ])
    expect(formsOf('venir', 'indicativo.indefinido')).toEqual([
      'vine',
      'viniste',
      'vino',
      'vinimos',
      'vinisteis',
      'vinieron',
    ])
    expect(at('venir', 'indicativo.futuro', 'yo')).toBe('vendré')
    expect(nonFinite('venir').gerundio).toBe('viniendo')
    expect(at('venir', 'imperativo.afirmativo', 'tu')).toBe('ven')
  })

  it('hacer — et son hizo', () => {
    expect(formsOf('hacer', 'indicativo.indefinido')).toEqual([
      'hice',
      'hiciste',
      'hizo',
      'hicimos',
      'hicisteis',
      'hicieron',
    ])
    expect(at('hacer', 'indicativo.presente', 'yo')).toBe('hago')
    expect(at('hacer', 'subjuntivo.presente', 'nosotros')).toBe('hagamos')
    expect(at('hacer', 'indicativo.futuro', 'yo')).toBe('haré')
    expect(nonFinite('hacer').participio).toBe('hecho')
    expect(at('hacer', 'imperativo.afirmativo', 'tu')).toBe('haz')
  })

  it('decir — le radical en j absorbe le i de -ieron', () => {
    expect(formsOf('decir', 'indicativo.presente')).toEqual([
      'digo',
      'dices',
      'dice',
      'decimos',
      'decís',
      'dicen',
    ])
    expect(formsOf('decir', 'indicativo.indefinido')).toEqual([
      'dije',
      'dijiste',
      'dijo',
      'dijimos',
      'dijisteis',
      'dijeron',
    ])
    expect(at('decir', 'indicativo.futuro', 'yo')).toBe('diré')
    expect(nonFinite('decir')).toMatchObject({ gerundio: 'diciendo', participio: 'dicho' })
    expect(at('decir', 'imperativo.afirmativo', 'tu')).toBe('di')
  })

  it('poder, poner, querer, saber, caber, andar', () => {
    expect(at('poder', 'indicativo.presente', 'yo')).toBe('puedo')
    expect(at('poder', 'subjuntivo.presente', 'nosotros')).toBe('podamos')
    expect(at('poder', 'indicativo.indefinido', 'yo')).toBe('pude')
    expect(at('poder', 'indicativo.futuro', 'yo')).toBe('podré')
    expect(nonFinite('poder').gerundio).toBe('pudiendo')

    expect(at('poner', 'indicativo.presente', 'yo')).toBe('pongo')
    expect(at('poner', 'indicativo.indefinido', 'yo')).toBe('puse')
    expect(at('poner', 'indicativo.futuro', 'yo')).toBe('pondré')
    expect(nonFinite('poner').participio).toBe('puesto')

    expect(at('querer', 'indicativo.presente', 'yo')).toBe('quiero')
    expect(at('querer', 'indicativo.indefinido', 'yo')).toBe('quise')
    expect(at('querer', 'indicativo.futuro', 'yo')).toBe('querré')

    expect(at('saber', 'indicativo.presente', 'yo')).toBe('sé')
    expect(at('saber', 'subjuntivo.presente', 'yo')).toBe('sepa')
    expect(at('saber', 'indicativo.indefinido', 'yo')).toBe('supe')
    expect(at('saber', 'indicativo.futuro', 'yo')).toBe('sabré')

    expect(at('caber', 'indicativo.presente', 'yo')).toBe('quepo')
    expect(at('caber', 'indicativo.indefinido', 'yo')).toBe('cupe')

    expect(at('andar', 'indicativo.indefinido', 'yo')).toBe('anduve')
    expect(at('andar', 'indicativo.presente', 'yo')).toBe('ando')
  })

  it('salir et traer', () => {
    expect(at('salir', 'indicativo.presente', 'yo')).toBe('salgo')
    expect(at('salir', 'indicativo.futuro', 'yo')).toBe('saldré')
    expect(at('salir', 'imperativo.afirmativo', 'tu')).toBe('sal')

    expect(at('traer', 'indicativo.presente', 'yo')).toBe('traigo')
    expect(formsOf('traer', 'indicativo.indefinido')).toEqual([
      'traje',
      'trajiste',
      'trajo',
      'trajimos',
      'trajisteis',
      'trajeron',
    ])
    expect(nonFinite('traer')).toMatchObject({ gerundio: 'trayendo', participio: 'traído' })
  })
})

describe('les quatre piliers suppletifs', () => {
  it('ser', () => {
    expect(formsOf('ser', 'indicativo.presente')).toEqual([
      'soy',
      'eres',
      'es',
      'somos',
      'sois',
      'son',
    ])
    expect(formsOf('ser', 'indicativo.imperfecto')).toEqual([
      'era',
      'eras',
      'era',
      'éramos',
      'erais',
      'eran',
    ])
    expect(formsOf('ser', 'indicativo.indefinido')).toEqual([
      'fui',
      'fuiste',
      'fue',
      'fuimos',
      'fuisteis',
      'fueron',
    ])
    expect(formsOf('ser', 'subjuntivo.presente')).toEqual([
      'sea',
      'seas',
      'sea',
      'seamos',
      'seáis',
      'sean',
    ])
    expect(formsOf('ser', 'subjuntivo.imperfecto')).toEqual([
      'fuera',
      'fueras',
      'fuera',
      'fuéramos',
      'fuerais',
      'fueran',
    ])
    expect(at('ser', 'indicativo.futuro', 'yo')).toBe('seré')
    expect(formsOf('ser', 'imperativo.afirmativo')).toEqual([
      null,
      'sé',
      'sea',
      'seamos',
      'sed',
      'sean',
    ])
    expect(nonFinite('ser')).toMatchObject({ gerundio: 'siendo', participio: 'sido' })
  })

  it('ir — et son prétérit emprunté à ser', () => {
    expect(formsOf('ir', 'indicativo.presente')).toEqual([
      'voy',
      'vas',
      'va',
      'vamos',
      'vais',
      'van',
    ])
    expect(formsOf('ir', 'indicativo.imperfecto')).toEqual([
      'iba',
      'ibas',
      'iba',
      'íbamos',
      'ibais',
      'iban',
    ])
    // `fui` vaut aussi bien pour ser que pour ir : seul le contexte les sépare.
    expect(formsOf('ir', 'indicativo.indefinido')).toEqual(formsOf('ser', 'indicativo.indefinido'))
    expect(formsOf('ir', 'subjuntivo.presente')).toEqual([
      'vaya',
      'vayas',
      'vaya',
      'vayamos',
      'vayáis',
      'vayan',
    ])
    expect(at('ir', 'indicativo.futuro', 'yo')).toBe('iré')
    expect(formsOf('ir', 'imperativo.afirmativo')).toEqual([
      null,
      've',
      'vaya',
      'vayamos',
      'id',
      'vayan',
    ])
    expect(nonFinite('ir')).toMatchObject({ gerundio: 'yendo', participio: 'ido' })
  })

  it('estar', () => {
    expect(formsOf('estar', 'indicativo.presente')).toEqual([
      'estoy',
      'estás',
      'está',
      'estamos',
      'estáis',
      'están',
    ])
    expect(formsOf('estar', 'subjuntivo.presente')).toEqual([
      'esté',
      'estés',
      'esté',
      'estemos',
      'estéis',
      'estén',
    ])
    expect(formsOf('estar', 'indicativo.indefinido')).toEqual([
      'estuve',
      'estuviste',
      'estuvo',
      'estuvimos',
      'estuvisteis',
      'estuvieron',
    ])
    expect(at('estar', 'indicativo.futuro', 'yo')).toBe('estaré')
  })

  it('haber — dans ses temps composés', () => {
    expect(at('hablar', 'indicativo.perfecto', 'yo')).toBe('he hablado')
    expect(at('escribir', 'indicativo.perfecto', 'yo')).toBe('he escrito')
    expect(at('hacer', 'indicativo.pluscuamperfecto', 'nosotros')).toBe('habíamos hecho')
    expect(at('ver', 'subjuntivo.perfecto', 'yo')).toBe('haya visto')
    expect(at('volver', 'indicativo.futuroPerfecto', 'ellos')).toBe('habrán vuelto')
  })
})

describe('dar, ver et oír', () => {
  it('dar', () => {
    expect(formsOf('dar', 'indicativo.presente')).toEqual([
      'doy',
      'das',
      'da',
      'damos',
      'dais',
      'dan',
    ])
    expect(formsOf('dar', 'subjuntivo.presente')).toEqual([
      'dé',
      'des',
      'dé',
      'demos',
      'deis',
      'den',
    ])
    expect(formsOf('dar', 'indicativo.indefinido')).toEqual([
      'di',
      'diste',
      'dio',
      'dimos',
      'disteis',
      'dieron',
    ])
    expect(at('dar', 'subjuntivo.imperfecto', 'nosotros')).toBe('diéramos')
  })

  it('ver', () => {
    expect(formsOf('ver', 'indicativo.presente')).toEqual([
      'veo',
      'ves',
      've',
      'vemos',
      'veis',
      'ven',
    ])
    expect(formsOf('ver', 'indicativo.imperfecto')).toEqual([
      'veía',
      'veías',
      'veía',
      'veíamos',
      'veíais',
      'veían',
    ])
    expect(formsOf('ver', 'indicativo.indefinido')).toEqual([
      'vi',
      'viste',
      'vio',
      'vimos',
      'visteis',
      'vieron',
    ])
    expect(nonFinite('ver')).toMatchObject({ gerundio: 'viendo', participio: 'visto' })
  })

  it('oír — malgré son infinitif accentué', () => {
    expect(formsOf('oír', 'indicativo.presente')).toEqual([
      'oigo',
      'oyes',
      'oye',
      'oímos',
      'oís',
      'oyen',
    ])
    expect(formsOf('oír', 'subjuntivo.presente')).toEqual([
      'oiga',
      'oigas',
      'oiga',
      'oigamos',
      'oigáis',
      'oigan',
    ])
    expect(formsOf('oír', 'indicativo.indefinido')).toEqual([
      'oí',
      'oíste',
      'oyó',
      'oímos',
      'oísteis',
      'oyeron',
    ])
    expect(nonFinite('oír')).toMatchObject({ gerundio: 'oyendo', participio: 'oído' })
  })
})

describe('participes irréguliers isolés', () => {
  it('escribir, abrir, cubrir, romper', () => {
    expect(nonFinite('escribir').participio).toBe('escrito')
    expect(nonFinite('abrir').participio).toBe('abierto')
    expect(nonFinite('cubrir').participio).toBe('cubierto')
    expect(nonFinite('romper').participio).toBe('roto')
    // Le reste de leur conjugaison est parfaitement régulier.
    expect(at('escribir', 'indicativo.presente', 'yo')).toBe('escribo')
    expect(at('romper', 'indicativo.indefinido', 'el')).toBe('rompió')
  })
})

describe('explication des irrégularités', () => {
  it('nomme la diphtongaison et la localise', () => {
    const form = conjugate('pensar', 'indicativo.presente', 'yo')
    expect(form?.value).toBe('pienso')
    expect(form?.regular).toBe('penso')

    const diphthong = form?.irregularities.find((item) => item.kind === 'diphthong')
    expect(diphthong?.explanation).toContain('e → ie')
    const [start, end] = diphthong!.span
    expect(form!.value.slice(start, end)).toBe('ie')
  })

  it('nomme le prétérit fort', () => {
    const form = conjugate('tener', 'indicativo.indefinido', 'yo')
    expect(form?.value).toBe('tuve')
    expect(form?.irregularities.some((item) => item.kind === 'strongPreterite')).toBe(true)
  })

  it('nomme le futur syncopé', () => {
    const form = conjugate('tener', 'indicativo.futuro', 'yo')
    expect(form?.value).toBe('tendré')
    expect(form?.regular).toBe('teneré')
    expect(form?.irregularities.some((item) => item.kind === 'syncopatedFuture')).toBe(true)
  })
})
