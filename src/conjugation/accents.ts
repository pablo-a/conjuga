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

/** Voyelles fortes : dans une diphtongue, ce sont elles qui portent l'accent. */
const STRONG_VOWELS = new Set('aeoáéó')

/**
 * Un monosyllabe — une seule émission de voix.
 *
 * Deux voyelles voisines ne font qu'une syllabe si l'une est faible : `rio` et
 * `fue` sont des monosyllabes. Mais deux voyelles fortes se prononcent séparément
 * — c'est un hiatus — et `veo` compte donc pour deux syllabes.
 *
 * Les monosyllabes espagnols ne portent jamais d'accent écrit : il n'y a pas
 * d'ambiguïté à lever. C'est ce qui rend leur préfixation délicate.
 */
export function isMonosyllable(word: string): boolean {
  let syllables = 0
  for (const group of word.match(/[aeiouáéíóú]+/g) ?? []) {
    const strong = [...group].filter((char) => STRONG_VOWELS.has(char)).length
    syllables += Math.max(1, strong)
  }
  return syllables <= 1
}

/**
 * Marque à l'écrit l'accent tonique de la dernière syllabe, quand l'orthographe
 * l'exige.
 *
 * Un mot terminé par une voyelle, un `n` ou un `s` se lit accentué sur
 * l'avant-dernière syllabe : `obten` se prononcerait « óbten ». L'accent écrit
 * rétablit la lecture réelle — `obtén`. Les mots terminés autrement
 * (`sobresal`, `deshaz`) se lisent déjà sur la dernière syllabe et n'ont rien
 * à marquer.
 */
export function accentFinalSyllable(word: string): string {
  const last = word.at(-1) ?? ''
  if (!VOWELS.has(last) && last !== 'n' && last !== 's') return word
  // Un accent est déjà écrit quelque part : la prononciation n'est pas ambiguë.
  if ([...word].some((char) => UNACCENTED[char] !== undefined)) return word

  let end = word.length
  while (end > 0 && !VOWELS.has(word[end - 1]!)) end--
  let start = end
  while (start > 0 && VOWELS.has(word[start - 1]!)) start--
  if (start === end) return word

  // Dans une diphtongue, l'accent va sur la voyelle forte : `-rio` → `-rió`.
  let index = end - 1
  for (let scan = start; scan < end; scan++) {
    if (STRONG_VOWELS.has(word[scan]!)) {
      index = scan
      break
    }
  }
  const char = word[index]!
  return word.slice(0, index) + (ACUTE[char] ?? char) + word.slice(index + 1)
}
