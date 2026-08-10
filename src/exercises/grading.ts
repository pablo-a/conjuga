import type { Form } from '@/conjugation'

/**
 * Correction d'une réponse tapée.
 *
 * Module pur : ni Vue, ni DOM, ni persistance. Il ne connaît que deux choses, la
 * réponse donnée et la cellule attendue.
 *
 * La règle qui gouverne tout : **les accents comptent**. `hablo` et `habló` sont
 * deux formes différentes, et les confondre est exactement l'erreur que l'app
 * doit corriger. Mais une faute d'accent seul n'est pas une faute de conjugaison —
 * l'apprenant a trouvé la bonne forme et manqué la place de l'accent tonique. Lui
 * répondre « faux » comme s'il avait écrit n'importe quoi lui apprend surtout à se
 * décourager. On distingue donc les deux.
 */

export type Verdict =
  /** Forme exacte, accents compris. */
  | 'correct'
  /** La bonne forme, mais mal accentuée : `hablo` pour `habló`. */
  | 'accent'
  /** Forme fausse. */
  | 'wrong'

export interface Grade {
  verdict: Verdict
  /** Réponse telle qu'elle a été comparée, après normalisation. */
  given: string
  /**
   * La forme attendue la plus proche de la réponse. Sur une cellule à plusieurs
   * formes correctes (`hablara` / `hablase`), c'est celle que l'apprenant visait
   * manifestement, et donc celle qu'il faut lui montrer.
   */
  expected: string
}

/**
 * Met la réponse dans la forme sous laquelle elle sera comparée : espaces de
 * bord, casse et espaces multiples ne sont jamais l'objet de l'exercice. Les
 * temps composés en contiennent un, légitime (`he hablado`).
 */
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Retire les marques que l'espagnol pose sur une voyelle — accent aigu et tréma —
 * sans toucher au `ñ`.
 *
 * Le `ñ` est une lettre à part entière de l'alphabet espagnol, pas un `n` décoré :
 * `año` et `ano` sont deux mots sans rapport, et les confondre n'a rien d'une
 * approximation d'accent. Le tréma, lui, en est bien une : entre `avergüenzo` et
 * `averguenzo`, l'apprenant a trouvé la forme.
 */
function foldDiacritics(word: string): string {
  return word.normalize('NFD').replace(/[́̈]/g, '').normalize('NFC')
}

/** Distance de Levenshtein, pour désigner la forme attendue la plus proche. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(substitution, previous[j]! + 1, current[j - 1]! + 1)
    }
    previous = current
  }
  return previous[b.length]!
}

/** Toutes les formes acceptées pour une cellule, la principale en tête. */
export function acceptedForms(form: Form): string[] {
  return [...new Set([form.value, ...form.alternatives])]
}

/**
 * Corrige une réponse contre une cellule du tableau de conjugaison.
 *
 * Les variantes également correctes sont acceptées sans réserve : au subjonctif
 * imparfait, `hablara` et `hablase` sont deux bonnes réponses, et n'en accepter
 * qu'une enseignerait une règle fausse.
 */
export function grade(answer: string, form: Form): Grade {
  const given = normalizeAnswer(answer)
  const candidates = acceptedForms(form).map(normalizeAnswer)

  const exact = candidates.find((candidate) => candidate === given)
  if (exact !== undefined) return { verdict: 'correct', given, expected: exact }

  const folded = foldDiacritics(given)
  const nearAccent = candidates.find((candidate) => foldDiacritics(candidate) === folded)
  if (nearAccent !== undefined) return { verdict: 'accent', given, expected: nearAccent }

  // Aucune correspondance : on montre la forme dont l'apprenant s'est le plus
  // approché, pas systématiquement la principale.
  const closest = candidates.reduce((best, candidate) =>
    distance(given, candidate) < distance(given, best) ? candidate : best,
  )
  return { verdict: 'wrong', given, expected: closest }
}

/**
 * Corrige une forme **désignée** parmi des propositions.
 *
 * La différence avec `grade` n'est pas une simplification : `accent` n'existe pas
 * ici, et ne doit pas exister. La tolérance de la production récompense
 * l'apprenant qui a trouvé la forme et manqué la syllabe tonique — un geste de
 * frappe. Cliquer sur `hablo` quand la réponse est `habló`, c'est avoir choisi
 * l'autre forme après l'avoir lue à côté de la bonne. Personne ne sélectionne un
 * accent par mégarde, et l'excuser reviendrait à ne pas poser la question.
 */
export function gradeSelection(chosen: string, form: Form): Grade {
  const given = normalizeAnswer(chosen)
  const candidates = acceptedForms(form).map(normalizeAnswer)
  const exact = candidates.find((candidate) => candidate === given)

  return exact !== undefined
    ? { verdict: 'correct', given, expected: exact }
    : { verdict: 'wrong', given, expected: candidates[0]! }
}

/**
 * Corrige une identification : on compare des clés, pas des formes.
 *
 * L'exercice inverse ne demande pas d'écrire quoi que ce soit — il demande de
 * nommer un verbe, un temps et une personne. Ce qui est juste ou faux est donc
 * l'identité désignée, et c'est la seule correction de l'app qui ne regarde pas
 * une forme espagnole.
 */
export function gradeIdentification(chosen: string, expected: string): Grade {
  return chosen === expected
    ? { verdict: 'correct', given: chosen, expected }
    : { verdict: 'wrong', given: chosen, expected }
}

/** Une réponse juste, accent compris ou non — ce qui compte pour « a-t-il trouvé la forme ? ». */
export const foundTheForm = (grade: Grade): boolean => grade.verdict !== 'wrong'
