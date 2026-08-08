import { stripAccents } from './accents'
import { VERB_MODELS } from './models'

/**
 * Recherche d'un verbe à conjuguer.
 *
 * Le moteur sait conjuguer n'importe quel infinitif en -ar, -er ou -ir, y compris
 * un verbe qu'il n'a jamais vu — il le traite alors comme régulier, ce qui est
 * juste dans l'immense majorité des cas. Ce module ne restreint donc pas la
 * saisie : il aide seulement à l'écrire correctement.
 *
 * Les verbes connus sont ceux dont le modèle est inscrit explicitement. Ce sont
 * précisément ceux qu'on ne peut pas deviner, donc ceux qu'il faut proposer.
 */

const KNOWN = Object.keys(VERB_MODELS).sort((a, b) => a.localeCompare(b, 'es'))

/**
 * Les accents espagnols sont pénibles à taper et absents de la plupart des
 * claviers : `reir` doit trouver `reír`. Sans cette table, le moteur conjuguerait
 * `reir` comme un -ir régulier et afficherait `reo` avec aplomb.
 */
const BY_STRIPPED = new Map(KNOWN.map((verb) => [stripAccents(verb), verb]))

/** Normalise une saisie : espaces superflus et majuscules n'ont rien à faire là. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

/**
 * L'infinitif à conjuguer pour une saisie donnée : l'orthographe canonique quand
 * le verbe est connu, la saisie telle quelle sinon.
 */
export function canonicalInfinitive(query: string): string {
  const normalized = normalizeQuery(query)
  if (normalized in VERB_MODELS) return normalized
  return BY_STRIPPED.get(stripAccents(normalized)) ?? normalized
}

/**
 * Verbes connus dont l'orthographe contient la saisie, accents ignorés.
 *
 * Le classement place d'abord ceux qui *commencent* par la saisie : en tapant
 * `ten`, on cherche `tener` avant `entretener`.
 */
export function suggestions(query: string, limit = 8): string[] {
  const needle = stripAccents(normalizeQuery(query))
  if (needle.length === 0) return []

  const starting: string[] = []
  const containing: string[] = []

  for (const verb of KNOWN) {
    const stripped = stripAccents(verb)
    if (stripped === needle) continue
    if (stripped.startsWith(needle)) starting.push(verb)
    else if (stripped.includes(needle)) containing.push(verb)
  }
  return [...starting, ...containing].slice(0, limit)
}

/** Tous les verbes au modèle explicitement connu, par ordre alphabétique. */
export const KNOWN_VERBS: readonly string[] = KNOWN
