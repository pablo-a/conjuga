import type { Form, Irregularity } from './types'

/**
 * Découpage d'une forme en segments surlignables.
 *
 * C'est la traduction de `Irregularity.span` — des bornes de caractères — en
 * quelque chose qu'une interface peut rendre directement. Le module reste pur :
 * il ne connaît ni Vue ni le DOM, et se teste comme le reste du moteur.
 *
 * Plusieurs irrégularités peuvent couvrir le même segment : `dormir` au subjonctif
 * de nosotros est à la fois un affaiblissement du radical et une conséquence de la
 * dérivation depuis `yo`. On les garde toutes, parce que l'explication affichée
 * doit être complète — mais on ne découpe qu'une fois.
 */
export interface Segment {
  text: string
  /** Vide pour un segment régulier. */
  irregularities: Irregularity[]
}

/** Les irrégularités qui couvrent chaque caractère de la forme. */
function coverage(form: Form): Irregularity[][] {
  const perCharacter: Irregularity[][] = Array.from({ length: form.value.length }, () => [])

  for (const irregularity of form.irregularities) {
    const [start, end] = irregularity.span
    // Les bornes viennent d'une comparaison avec la forme régulière, qui n'a pas
    // la même longueur : on les ramène dans la forme réelle plutôt que de risquer
    // un segment fantôme.
    const from = Math.max(0, Math.min(start, form.value.length))
    const to = Math.max(from, Math.min(end, form.value.length))
    for (let index = from; index < to; index++) perCharacter[index]!.push(irregularity)
  }
  return perCharacter
}

const sameCoverage = (a: Irregularity[], b: Irregularity[]): boolean =>
  a.length === b.length && a.every((irregularity, index) => irregularity === b[index])

/**
 * Découpe la forme en tranches consécutives partageant les mêmes irrégularités.
 * Une forme régulière donne un segment unique, sans irrégularité.
 */
export function segmentsOf(form: Form): Segment[] {
  if (form.irregularities.length === 0) {
    return form.value.length > 0 ? [{ text: form.value, irregularities: [] }] : []
  }

  const perCharacter = coverage(form)
  const segments: Segment[] = []

  // Indexation par unité de code, comme les bornes de `span` que produit
  // `differenceSpan` : les deux doivent parler de la même chose.
  for (let index = 0; index < form.value.length; index++) {
    const here = perCharacter[index]!
    const last = segments.at(-1)
    if (last && sameCoverage(last.irregularities, here)) {
      last.text += form.value[index]!
    } else {
      segments.push({ text: form.value[index]!, irregularities: here })
    }
  }
  return segments
}
