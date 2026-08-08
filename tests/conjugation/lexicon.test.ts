import words from 'an-array-of-spanish-words'
import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import { VERB_MODELS } from '@/conjugation/models'
import { PERSONS, SIMPLE_TENSES } from '@/conjugation/types'

/**
 * Vérification lexicale contre une source externe et indépendante.
 *
 * Chaque forme produite par le moteur doit être un mot espagnol attesté dans une
 * liste de 636 000 mots (`an-array-of-spanish-words`, MIT, projet `words`).
 *
 * Ce que ce test garantit : le moteur n'invente pas de mots. Une mauvaise
 * affectation de modèle — le vrai risque quand on étendra la table aux 1000
 * verbes — produit presque toujours une forme inexistante (`adquiro`, `cuentaría`,
 * `construo`) et sera donc attrapée ici.
 *
 * Ce que ce test ne garantit PAS, et qui reste couvert par les tables écrites à
 * la main dans les autres fichiers :
 *  - que la forme soit la bonne *pour cette case* — `hablo` est un mot valide,
 *    même à la place de `hablé` ;
 *  - l'accentuation, car la liste est essentiellement dépourvue d'accents et la
 *    comparaison doit donc les ignorer. `hablo` et `habló` y sont indiscernables.
 *
 * Un premier essai s'appuyait sur le paquet `spanish-verbs` comme oracle de
 * conjugaison. Il a été abandonné : sur 88 verbes testés il divergeait sur 60,
 * et l'examen manuel a montré que l'erreur était presque toujours de son côté
 * — conditionnel diphtongué (`cuentaría`), prétérits forts ignorés (`andé`),
 * et jusqu'à des formes de `tener` renvoyées pour `hacer`.
 */

/** La liste ignore accents et tréma : la comparaison doit faire de même. */
function normalize(word: string): string {
  return word.normalize('NFD').replace(/[̀-̈]/g, '').normalize('NFC').toLowerCase()
}

/**
 * Formes correctes mais absentes de la liste, avec leur justification.
 * Toute nouvelle entrée doit être vérifiée à la main avant d'être ajoutée.
 */
const ATTESTED_BUT_ABSENT = new Set([
  // Impératif de vosotros de `haber`, morphologiquement régulier mais inusité :
  // `haber` ne s'emploie plus qu'en auxiliaire, où l'impératif n'a pas de sens.
  'habed',
  // Impératif de vosotros de `arrepentir`, verbe essentiellement pronominal :
  // on dit `arrepentíos`, la forme pronominale perdant son -d devant -os. La
  // forme nue est correctement construite, mais ne s'emploie jamais seule.
  'arrepentid',
])

const REGULAR_SAMPLE = [
  'hablar',
  'comer',
  'vivir',
  'trabajar',
  'estudiar',
  'llamar',
  'quedar',
  'pasar',
  'entrar',
  'llevar',
  'dejar',
  'beber',
  'aprender',
  'vender',
  'correr',
  'deber',
  'recibir',
  'subir',
  'partir',
  'buscar',
  'llegar',
  'cruzar',
  'pagar',
  'tocar',
  'sacar',
  'realizar',
  'utilizar',
  'averiguar',
  'coger',
  'dirigir',
  'distinguir',
  'vencer',
  'esparcir',
  'delinquir',
  'leer',
  'creer',
  'poseer',
  'bullir',
  'tañer',
]

const VERBS = [...new Set([...Object.keys(VERB_MODELS), ...REGULAR_SAMPLE])].sort()

const LEXICON = new Set((words as string[]).map(normalize))

interface Unknown {
  verb: string
  tense: string
  person: string
  form: string
}

function scanAllForms(): { total: number; unknown: Unknown[] } {
  const unknown: Unknown[] = []
  let total = 0

  for (const verb of VERBS) {
    for (const tense of SIMPLE_TENSES) {
      for (const person of PERSONS) {
        const form = conjugate(verb, tense, person)?.value
        if (!form) continue
        total++
        const normalized = normalize(form)
        if (!LEXICON.has(normalized) && !ATTESTED_BUT_ABSENT.has(normalized)) {
          unknown.push({ verb, tense, person, form })
        }
      }
    }
  }
  return { total, unknown }
}

describe('toutes les formes produites sont des mots espagnols attestés', () => {
  const { total, unknown } = scanAllForms()

  it('couvre un volume significatif de formes', () => {
    expect(total).toBeGreaterThan(6000)
  })

  it('n’invente aucun mot', () => {
    const report = unknown
      .slice(0, 40)
      .map((item) => `${item.verb} ${item.tense} ${item.person} → ${item.form}`)
      .join('\n')
    expect(unknown.length, `${unknown.length} forme(s) inconnue(s)\n${report}`).toBe(0)
  })
})

describe('le lexique reconnaît bien ce qu’il doit reconnaître', () => {
  // Sans ce garde-fou, une liste vide ou mal chargée ferait passer le test
  // précédent pour de bonnes raisons apparentes.
  it('contient les formes de contrôle', () => {
    for (const form of ['pienso', 'durmió', 'anduviéramos', 'construyendo', 'quepo']) {
      expect(LEXICON.has(normalize(form)), form).toBe(true)
    }
  })

  it('rejette les formes fautives', () => {
    for (const form of ['cuentaría', 'construo', 'adquiro', 'cogo', 'duermiría']) {
      expect(LEXICON.has(normalize(form)), form).toBe(false)
    }
  })
})
