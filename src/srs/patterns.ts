import type { Tense } from '@/conjugation'

/**
 * Ce que les erreurs disent des **patrons**, pas des verbes.
 *
 * C'est la mesure qui distingue l'app d'un paquet de cartes : savoir qu'on rate
 * `pensar` n'apprend rien, savoir qu'on rate les `e→ie` au subjonctif renvoie à
 * une règle et à la fiche qui l'explique. Module pur — l'agrégat vient de la
 * base, la lecture qu'on en fait est ici, donc testable sans base.
 */

/** Un agrégat `(modèle, temps)` tel que la persistance le range. */
export interface PatternCount {
  model: string
  tense: string
  attempts: number
  errors: number
}

/** Compteurs cumulés sur un ensemble de patrons. */
export interface Score {
  attempts: number
  errors: number
}

/**
 * En dessous de ce nombre de tentatives, on ne conclut rien.
 *
 * Une forme ratée une fois donne 100 % d'échec, ce qui n'est pas une faiblesse
 * mais un manque de données : proposer une fiche de théorie sur cette base
 * enverrait l'apprenant réviser un patron qu'il connaît peut-être très bien.
 */
export const MIN_ATTEMPTS = 10

/** Part de réussite, entre 0 et 1. Un patron jamais tenté vaut 0. */
export function successRate(score: Score): number {
  if (score.attempts === 0) return 0
  return (score.attempts - score.errors) / score.attempts
}

/** Vrai quand assez de formes ont été demandées pour que le taux veuille dire quelque chose. */
export const isMeaningful = (score: Score): boolean => score.attempts >= MIN_ATTEMPTS

/** Cumule les patrons temps par temps, tous modèles confondus. */
export function byTense(counts: readonly PatternCount[]): Map<Tense, Score> {
  const scores = new Map<Tense, Score>()
  for (const count of counts) {
    const tense = count.tense as Tense
    const score = scores.get(tense) ?? { attempts: 0, errors: 0 }
    score.attempts += count.attempts
    score.errors += count.errors
    scores.set(tense, score)
  }
  return scores
}

/** Le cumul d'un ensemble de temps — ce qu'une fiche couvre. */
export function totalFor(counts: readonly PatternCount[], tenses: readonly Tense[]): Score {
  const wanted = new Set<string>(tenses)
  return counts
    .filter((count) => wanted.has(count.tense))
    .reduce<Score>(
      (total, count) => ({
        attempts: total.attempts + count.attempts,
        errors: total.errors + count.errors,
      }),
      { attempts: 0, errors: 0 },
    )
}

/**
 * Les patrons les plus ratés parmi les temps donnés, du pire au moins pire.
 *
 * Seuls les patrons réellement mis à l'épreuve sont classés, et ceux sans erreur
 * sont écartés : une liste de faiblesses qui contient des réussites n'est plus
 * une liste de faiblesses.
 */
export function weakest(
  counts: readonly PatternCount[],
  tenses: readonly Tense[],
  limit = 3,
): PatternCount[] {
  const wanted = new Set<string>(tenses)
  return counts
    .filter((count) => wanted.has(count.tense) && isMeaningful(count) && count.errors > 0)
    .sort((a, b) => successRate(a) - successRate(b))
    .slice(0, limit)
}
