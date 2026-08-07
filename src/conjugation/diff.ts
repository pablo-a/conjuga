/**
 * Localise ce qui distingue une forme réelle de la forme régulière attendue.
 *
 * Le résultat sert à surligner le segment irrégulier dans l'interface : c'est ce
 * qui transforme un exercice de mémorisation en apprentissage de patron.
 */
export function differenceSpan(regular: string, actual: string): [number, number] | null {
  if (regular === actual) return null

  const limit = Math.min(regular.length, actual.length)

  let start = 0
  while (start < limit && regular[start] === actual[start]) start++

  let endRegular = regular.length
  let endActual = actual.length
  while (
    endRegular > start &&
    endActual > start &&
    regular[endRegular - 1] === actual[endActual - 1]
  ) {
    endRegular--
    endActual--
  }

  // Une forme entièrement suppletive (`ir` → `fui`) n'a aucun segment commun :
  // on surligne alors la forme entière plutôt qu'un fragment trompeur.
  return [start, endActual]
}
