import type { Conjugation } from './types'

/**
 * Adaptations purement graphiques du radical et de la terminaison.
 *
 * Ces verbes ne sont pas irréguliers : leur radical garde exactement le même son.
 * C'est l'orthographe espagnole qui impose de l'écrire autrement selon la voyelle
 * qui suit — `busco` mais `busqué`, `cojo` mais `coges`. Les présenter comme une
 * règle de son plutôt que comme une liste d'exceptions divise le travail de
 * mémorisation par dix.
 */
export interface Orthography {
  stem: string
  ending: string
  /** Explication affichée quand la forme est corrigée. `null` si rien n'a changé. */
  rule: string | null
}

/** Voyelles fortes : elles forment un hiatus avec le i, qui prend alors un accent. */
const STRONG_VOWELS = new Set('aeo')
const FRONT_TRIGGERS = new Set('eé')
const BACK_TRIGGERS = new Set('aáoó')
const VOWELS = new Set('aeiouáéíóú')

/** Le u de `gu` et `qu` est muet : il ne compte pas comme voyelle finale de radical. */
function endsInSilentU(stem: string): boolean {
  return stem.endsWith('gu') || stem.endsWith('qu')
}

/**
 * Les règles sur les consonnes ne valent que si la consonne vient de l'infinitif.
 *
 * Sans cette garde, le `g` que `tener` ou `oír` ajoutent à leur radical
 * (`teng-`, `oig-`) subirait la règle de `coger` et donnerait `tenja`, `oija`.
 * Or ce `g` n'a jamais été suivi d'un `e` : il est dur depuis le début et ne
 * demande aucune protection.
 */
function inheritedFromInfinitive(infinitiveStem: string, cluster: string): boolean {
  return infinitiveStem.endsWith(cluster)
}

export function applyOrthography(
  conjugation: Conjugation,
  stem: string,
  ending: string,
  infinitiveStem: string,
): Orthography {
  const first = ending[0] ?? ''
  const second = ending[1] ?? ''
  const unchanged: Orthography = { stem, ending, rule: null }

  const replaceEnd = (cluster: string, replacement: string, rule: string): Orthography | null => {
    if (!stem.endsWith(cluster)) return null
    if (!inheritedFromInfinitive(infinitiveStem, cluster)) return null
    return { stem: stem.slice(0, -cluster.length) + replacement, ending, rule }
  }

  if (conjugation === 'ar') {
    // Radical suivi de a ou o à l'infinitif : il faut le protéger devant e.
    if (!FRONT_TRIGGERS.has(first)) return unchanged
    return (
      replaceEnd('gu', 'gü', 'gu → gü devant e, pour que le u reste prononcé') ??
      replaceEnd('c', 'qu', 'c → qu devant e, pour garder le son [k]') ??
      replaceEnd('g', 'gu', 'g → gu devant e, pour garder le son [g]') ??
      replaceEnd('z', 'c', 'z → c devant e, par convention orthographique') ??
      unchanged
    )
  }

  // Verbes en -er et -ir : radical suivi de e ou i à l'infinitif, à protéger devant a et o.
  if (BACK_TRIGGERS.has(first)) {
    // Le groupe `zc` des incohatifs (`conozco`) est déjà la graphie correcte.
    if (stem.endsWith('zc')) return unchanged
    return (
      replaceEnd('gu', 'g', 'gu → g devant a et o : le u n’a plus lieu d’être') ??
      replaceEnd('qu', 'c', 'qu → c devant a et o : le u n’a plus lieu d’être') ??
      replaceEnd('g', 'j', 'g → j devant a et o, pour garder le son [x]') ??
      replaceEnd('c', 'z', 'c → z devant a et o, pour garder le son [θ]') ??
      unchanged
    )
  }

  if (first !== 'i') return unchanged

  const last = stem.at(-1) ?? ''

  // Le i atone entre deux voyelles devient y : `le` + `ió` → `leyó`.
  if (VOWELS.has(second) && VOWELS.has(last) && !endsInSilentU(stem)) {
    return { stem, ending: `y${ending.slice(1)}`, rule: 'le i entre deux voyelles s’écrit y' }
  }

  // Après ñ, ll ou ch, le i de la terminaison est absorbé : `bull` + `ió` → `bulló`.
  if (VOWELS.has(second) && (stem.endsWith('ñ') || stem.endsWith('ll') || stem.endsWith('ch'))) {
    return {
      stem,
      ending: ending.slice(1),
      rule: 'le i disparaît après ñ, ll et ch, déjà mouillés',
    }
  }

  // Hiatus avec une voyelle forte : le i porte l'accent (`leíste`, `leído`).
  if (!VOWELS.has(second) && STRONG_VOWELS.has(last)) {
    return {
      stem,
      ending: `í${ending.slice(1)}`,
      rule: 'le i accentué marque l’hiatus avec la voyelle du radical',
    }
  }

  return unchanged
}

/** Concatène radical et terminaison en appliquant les adaptations graphiques. */
export function joinWithOrthography(
  conjugation: Conjugation,
  stem: string,
  ending: string,
  infinitiveStem: string,
): { value: string; rule: string | null } {
  const result = applyOrthography(conjugation, stem, ending, infinitiveStem)
  return { value: result.stem + result.ending, rule: result.rule }
}
