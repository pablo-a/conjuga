/** Voyelles et leur équivalent accentué aigu. */
const ACUTE: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }
const UNACCENTED: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }

const VOWELS = new Set('aeiouáéíóú')

export function isVowel(char: string): boolean {
  return VOWELS.has(char)
}

/** Retire les accents aigus, sans toucher au `ñ` ni au tréma. */
export function stripAccents(word: string): string {
  return [...word].map((char) => UNACCENTED[char] ?? char).join('')
}

/**
 * Accentue la dernière voyelle du mot.
 *
 * Sert à construire la première personne du pluriel du subjonctif imparfait et
 * du subjonctif futur, dont l'accent tonique remonte d'une syllabe :
 * `hablá` + `ramos` → `habláramos`, `hubié` + `ramos` → `hubiéramos`.
 */
export function accentLastVowel(word: string): string {
  for (let index = word.length - 1; index >= 0; index--) {
    const char = word[index]!
    if (VOWELS.has(char)) {
      // Déjà accentuée : rien à faire.
      if (UNACCENTED[char]) return word
      return word.slice(0, index) + ACUTE[char]! + word.slice(index + 1)
    }
  }
  return word
}
