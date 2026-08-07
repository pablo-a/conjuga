import { stripAccents } from './accents'
import type { Conjugation, Person } from './types'

/** Terminaisons dans l'ordre de `PERSONS`. */
export type EndingSet = readonly [string, string, string, string, string, string]

/**
 * Ce à quoi la terminaison se colle :
 * - `stem` : l'infinitif privé de ses deux dernières lettres (`hablar` → `habl`) ;
 * - `infinitive` : l'infinitif entier, pour le futur et le conditionnel
 *   (`hablar` + `é` → `hablaré`), qui sont les seuls temps construits ainsi.
 */
export type EndingBase = 'stem' | 'infinitive'

export interface EndingTable {
  base: EndingBase
  ar: EndingSet
  er: EndingSet
  ir: EndingSet
}

/**
 * Le futur et le conditionnel ne dépendent pas du groupe : les mêmes terminaisons
 * se collent à l'infinitif entier, quel que soit le verbe.
 */
const FUTURE: EndingSet = ['é', 'ás', 'á', 'emos', 'éis', 'án']
const CONDITIONAL: EndingSet = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']

/** L'imparfait de l'indicatif est identique pour -er et -ir. */
const IMPERFECT_ER_IR: EndingSet = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']

/** Le prétérit des -er et des -ir est identique lui aussi. */
const PRETERITE_ER_IR: EndingSet = ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron']

const SUBJUNCTIVE_ER_IR: EndingSet = ['a', 'as', 'a', 'amos', 'áis', 'an']

export const ENDINGS = {
  'indicativo.presente': {
    base: 'stem',
    ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
    er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  },
  'indicativo.imperfecto': {
    base: 'stem',
    ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
    er: IMPERFECT_ER_IR,
    ir: IMPERFECT_ER_IR,
  },
  'indicativo.indefinido': {
    base: 'stem',
    ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
    er: PRETERITE_ER_IR,
    ir: PRETERITE_ER_IR,
  },
  'indicativo.futuro': { base: 'infinitive', ar: FUTURE, er: FUTURE, ir: FUTURE },
  'indicativo.condicional': {
    base: 'infinitive',
    ar: CONDITIONAL,
    er: CONDITIONAL,
    ir: CONDITIONAL,
  },
  'subjuntivo.presente': {
    base: 'stem',
    ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
    er: SUBJUNCTIVE_ER_IR,
    ir: SUBJUNCTIVE_ER_IR,
  },
} as const satisfies Record<string, EndingTable>

export type EndingTableId = keyof typeof ENDINGS

/**
 * Terminaisons atones des prétérits forts : `tener` → `tuve`, `decir` → `dijo`.
 * Elles ne portent jamais d'accent écrit, contrairement au prétérit régulier
 * (`hablé`, `habló`) — c'est la marque visible d'un prétérit fort.
 */
export const STRONG_PRETERITE_ENDINGS: EndingSet = ['e', 'iste', 'o', 'imos', 'isteis', 'ieron']

/**
 * Le subjonctif imparfait et le subjonctif futur se construisent tous deux sur la
 * troisième personne du pluriel du prétérit, privée de son `-ron`. La règle ne
 * souffre aucune exception, y compris pour les verbes les plus irréguliers :
 * `hubieron` → `hubie-` → `hubiera`, `hubiese`, `hubiere`.
 */
export const SUBJUNCTIVE_IMPERFECT_RA: EndingSet = ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran']
export const SUBJUNCTIVE_IMPERFECT_SE: EndingSet = ['se', 'ses', 'se', 'semos', 'seis', 'sen']
export const SUBJUNCTIVE_FUTURE: EndingSet = ['re', 'res', 're', 'remos', 'reis', 'ren']

/** Terminaisons des formes non conjuguées. */
export const NON_FINITE_ENDINGS: Record<Conjugation, { gerundio: string; participio: string }> = {
  ar: { gerundio: 'ando', participio: 'ado' },
  er: { gerundio: 'iendo', participio: 'ido' },
  ir: { gerundio: 'iendo', participio: 'ido' },
}

/**
 * Impératif affirmatif de `vosotros` : l'infinitif dont le `r` final devient `d`.
 * Aucune exception, pas même `ser` (`sed`) ou `ir` (`id`).
 */
export function vosotrosImperative(infinitive: string): string {
  return `${infinitive.slice(0, -1)}d`
}

/**
 * Groupe d'un infinitif, ou `null` si la terminaison n'est pas conjugable.
 * L'accent est ignoré : `oír` et `reír` appartiennent bien au groupe des -ir.
 */
export function conjugationOf(infinitive: string): Conjugation | null {
  const suffix = stripAccents(infinitive.slice(-2))
  return suffix === 'ar' || suffix === 'er' || suffix === 'ir' ? suffix : null
}

/** Radical régulier : l'infinitif privé de sa terminaison de groupe. */
export function stemOf(infinitive: string): string {
  return infinitive.slice(0, -2)
}

export const PERSON_INDEX: Record<Person, 0 | 1 | 2 | 3 | 4 | 5> = {
  yo: 0,
  tu: 1,
  el: 2,
  nosotros: 3,
  vosotros: 4,
  ellos: 5,
}
