import { describe, expect, it } from 'vitest'

import { conjugate, conjugateAll, nonFinite } from '@/conjugation'
import type { Tense } from '@/conjugation/types'

/**
 * Tables de référence des familles ajoutées après la première vague de modèles.
 *
 * Comme les autres fichiers de ce répertoire, elles sont **écrites à la main** et
 * ne sont dérivées d'aucun code : c'est le point fixe contre lequel le moteur est
 * jugé, et les régénérer depuis sa sortie reviendrait à ne plus rien vérifier.
 *
 * Le contrôle lexical (`lexicon.test.ts`) est complémentaire mais aveugle à deux
 * choses que ces tables voient : la place d'une forme dans le paradigme, et son
 * accentuation.
 */

const formsOf = (infinitive: string, tense: Tense) =>
  conjugateAll(infinitive, tense).map((form) => form?.value ?? null)

const check = (infinitive: string, cases: Array<[Tense, Array<string | null>]>) => {
  it.each(cases)(`${infinitive} — %s`, (tense, expected) => {
    expect(formsOf(infinitive, tense)).toEqual(expected)
  })
}

describe('errar — la diphtongue ie s’écrit ye en tête de mot', () => {
  check('errar', [
    ['indicativo.presente', ['yerro', 'yerras', 'yerra', 'erramos', 'erráis', 'yerran']],
    ['subjuntivo.presente', ['yerre', 'yerres', 'yerre', 'erremos', 'erréis', 'yerren']],
    ['indicativo.indefinido', ['erré', 'erraste', 'erró', 'erramos', 'errasteis', 'erraron']],
    ['imperativo.afirmativo', [null, 'yerra', 'yerre', 'erremos', 'errad', 'yerren']],
  ])

  it('ne contamine pas les verbes formés sur *tierra*', () => {
    // `enterrar` et `desterrar` viennent du nom, pas du verbe `errar` : ils
    // diphtonguent normalement en `ie`.
    expect(conjugate('enterrar', 'indicativo.presente', 'yo')?.value).toBe('entierro')
    expect(conjugate('desterrar', 'indicativo.presente', 'yo')?.value).toBe('destierro')
  })
})

describe('avergonzar — le u de la diphtongue prend un tréma derrière le g', () => {
  check('avergonzar', [
    [
      'indicativo.presente',
      ['avergüenzo', 'avergüenzas', 'avergüenza', 'avergonzamos', 'avergonzáis', 'avergüenzan'],
    ],
    [
      'subjuntivo.presente',
      ['avergüence', 'avergüences', 'avergüence', 'avergoncemos', 'avergoncéis', 'avergüencen'],
    ],
    [
      'indicativo.indefinido',
      ['avergoncé', 'avergonzaste', 'avergonzó', 'avergonzamos', 'avergonzasteis', 'avergonzaron'],
    ],
  ])

  it('vaut pour toute la famille', () => {
    expect(conjugate('degollar', 'indicativo.presente', 'yo')?.value).toBe('degüello')
    expect(conjugate('agorar', 'indicativo.presente', 'yo')?.value).toBe('agüero')
  })

  it('laisse tranquille un gu hérité de l’infinitif', () => {
    // Le u de `colgar` est déjà muet et suivi d'un o : rien à signaler.
    expect(conjugate('colgar', 'indicativo.presente', 'yo')?.value).toBe('cuelgo')
    expect(conjugate('rogar', 'subjuntivo.presente', 'yo')?.value).toBe('ruegue')
  })
})

describe('negar — diphtongaison et adaptation graphique se cumulent', () => {
  check('negar', [
    ['indicativo.presente', ['niego', 'niegas', 'niega', 'negamos', 'negáis', 'niegan']],
    ['subjuntivo.presente', ['niegue', 'niegues', 'niegue', 'neguemos', 'neguéis', 'nieguen']],
    ['indicativo.indefinido', ['negué', 'negaste', 'negó', 'negamos', 'negasteis', 'negaron']],
  ])
})

describe('absolver — participe en -to, sans être un dérivé de volver', () => {
  check('absolver', [
    [
      'indicativo.presente',
      ['absuelvo', 'absuelves', 'absuelve', 'absolvemos', 'absolvéis', 'absuelven'],
    ],
  ])

  it('bâtit son participe sur son propre radical', () => {
    // `absolver` et `disolver` viennent de *solvere*, pas de *volvere* : le
    // participe ne peut donc pas être le `vuelto` de `volver` préfixé.
    expect(nonFinite('absolver').participio).toBe('absuelto')
    expect(nonFinite('disolver').participio).toBe('disuelto')
    expect(nonFinite('resolver').participio).toBe('resuelto')
    expect(nonFinite('devolver').participio).toBe('devuelto')
    expect(nonFinite('volver').participio).toBe('vuelto')
  })
})

describe('reír — affaiblissement e → i, et fusion des deux i', () => {
  check('reír', [
    ['indicativo.presente', ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen']],
    ['indicativo.indefinido', ['reí', 'reíste', 'rio', 'reímos', 'reísteis', 'rieron']],
    ['subjuntivo.presente', ['ría', 'rías', 'ría', 'riamos', 'riáis', 'rían']],
    ['subjuntivo.imperfecto', ['riera', 'rieras', 'riera', 'riéramos', 'rierais', 'rieran']],
    ['imperativo.afirmativo', [null, 'ríe', 'ría', 'riamos', 'reíd', 'rían']],
  ])

  it('a un gérondif et un participe conformes', () => {
    expect(nonFinite('reír')).toEqual({
      infinitivo: 'reír',
      gerundio: 'riendo',
      participio: 'reído',
    })
  })
})

describe('sonreír — le monosyllabe rio prend un accent une fois préfixé', () => {
  check('sonreír', [
    ['indicativo.presente', ['sonrío', 'sonríes', 'sonríe', 'sonreímos', 'sonreís', 'sonríen']],
    [
      'indicativo.indefinido',
      ['sonreí', 'sonreíste', 'sonrió', 'sonreímos', 'sonreísteis', 'sonrieron'],
    ],
  ])
})

describe('freír — deux participes, tous deux corrects', () => {
  check('freír', [
    ['indicativo.presente', ['frío', 'fríes', 'fríe', 'freímos', 'freís', 'fríen']],
    ['indicativo.indefinido', ['freí', 'freíste', 'frio', 'freímos', 'freísteis', 'frieron']],
  ])

  it('accepte freído à côté de frito', () => {
    const form = conjugate('freír', 'indicativo.perfecto', 'yo')
    expect(form?.value).toBe('he frito')
    expect(form?.alternatives).toContain('he freído')
  })
})

describe('reñir — le ñ absorbe le i de la terminaison', () => {
  check('reñir', [
    ['indicativo.presente', ['riño', 'riñes', 'riñe', 'reñimos', 'reñís', 'riñen']],
    ['indicativo.indefinido', ['reñí', 'reñiste', 'riñó', 'reñimos', 'reñisteis', 'riñeron']],
    ['subjuntivo.presente', ['riña', 'riñas', 'riña', 'riñamos', 'riñáis', 'riñan']],
  ])

  it('vaut pour ceñir et teñir', () => {
    expect(conjugate('ceñir', 'indicativo.indefinido', 'el')?.value).toBe('ciñó')
    expect(conjugate('teñir', 'indicativo.indefinido', 'ellos')?.value).toBe('tiñeron')
    expect(nonFinite('reñir').gerundio).toBe('riñendo')
  })
})

describe('lucir — les -ucir sont incohatifs sans prétérit fort', () => {
  check('lucir', [
    ['indicativo.presente', ['luzco', 'luces', 'luce', 'lucimos', 'lucís', 'lucen']],
    ['subjuntivo.presente', ['luzca', 'luzcas', 'luzca', 'luzcamos', 'luzcáis', 'luzcan']],
    ['indicativo.indefinido', ['lucí', 'luciste', 'lució', 'lucimos', 'lucisteis', 'lucieron']],
  ])

  it('ne prend pas le prétérit fort des -ducir', () => {
    // `conducir` fait `conduje` ; `lucir` s'arrête au `zc` du présent.
    expect(conjugate('conducir', 'indicativo.indefinido', 'yo')?.value).toBe('conduje')
    expect(conjugate('relucir', 'indicativo.indefinido', 'yo')?.value).toBe('relucí')
  })
})

describe('concernir — défectif, limité aux troisièmes personnes', () => {
  check('concernir', [
    ['indicativo.presente', [null, null, 'concierne', null, null, 'conciernen']],
    ['indicativo.indefinido', [null, null, 'concernió', null, null, 'concernieron']],
    ['subjuntivo.presente', [null, null, 'concierna', null, null, 'conciernan']],
    ['imperativo.afirmativo', [null, null, null, null, null, null]],
  ])

  it('se distingue de discernir, qui n’est pas défectif', () => {
    expect(conjugate('discernir', 'indicativo.presente', 'yo')?.value).toBe('discierno')
    // Ni l'un ni l'autre ne s'affaiblit au prétérit : `discirnió` n'existe pas.
    expect(conjugate('discernir', 'indicativo.indefinido', 'el')?.value).toBe('discernió')
  })
})

describe('prever — dérivé d’un verbe de base monosyllabique', () => {
  check('prever', [
    ['indicativo.presente', ['preveo', 'prevés', 'prevé', 'prevemos', 'prevéis', 'prevén']],
    [
      'indicativo.indefinido',
      ['preví', 'previste', 'previó', 'previmos', 'previsteis', 'previeron'],
    ],
  ])

  it('hérite du participe de ver', () => {
    expect(nonFinite('prever').participio).toBe('previsto')
  })

  it('n’accentue que ce qui était monosyllabique', () => {
    // `ves` est monosyllabique, `vemos` non : seul le premier réclame un accent
    // écrit une fois préfixé.
    expect(conjugate('prever', 'indicativo.presente', 'tu')?.value).toBe('prevés')
    expect(conjugate('prever', 'indicativo.presente', 'nosotros')?.value).toBe('prevemos')
  })
})

describe('les dérivés préfixés gardent l’accent tonique de leur base', () => {
  it('marque l’accent quand la base est un monosyllabe', () => {
    const cases: Array<[string, string]> = [
      ['obtener', 'obtén'],
      ['sostener', 'sostén'],
      ['proponer', 'propón'],
      ['componer', 'compón'],
      ['convenir', 'convén'],
      ['deshacer', 'deshaz'],
      ['sobresalir', 'sobresal'],
    ]
    for (const [infinitive, expected] of cases) {
      expect(conjugate(infinitive, 'imperativo.afirmativo', 'tu')?.value).toBe(expected)
    }
  })

  it('ne marque rien quand la base est polysyllabique', () => {
    // `puso` et `vino` portent déjà leur accent tonique sur l'avant-dernière
    // syllabe : préfixés, ils se lisent toujours de la même façon.
    expect(conjugate('proponer', 'indicativo.indefinido', 'el')?.value).toBe('propuso')
    expect(conjugate('convenir', 'indicativo.indefinido', 'el')?.value).toBe('convino')
    expect(conjugate('intervenir', 'indicativo.indefinido', 'el')?.value).toBe('intervino')
  })

  it('ne marque rien quand le modèle refait la forme du dérivé', () => {
    // `decir` fait `di`, mais ses dérivés refont leur impératif sur `dice` : la
    // syllabe finale n'est plus celle du monosyllabe.
    expect(conjugate('decir', 'imperativo.afirmativo', 'tu')?.value).toBe('di')
    expect(conjugate('contradecir', 'imperativo.afirmativo', 'tu')?.value).toBe('contradice')
    expect(conjugate('predecir', 'imperativo.afirmativo', 'tu')?.value).toBe('predice')
  })
})
