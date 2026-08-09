import { describe, expect, it } from 'vitest'

import { conjugate } from '@/conjugation'
import type { Form, Person, Tense } from '@/conjugation'
import { distractorsFor } from '@/exercises/distractors'

/**
 * Ce qu'on vérifie ici n'est pas qu'un QCM ait quatre lignes, mais que ses
 * mauvaises réponses **enseignent** : chacune doit être une forme que le moteur
 * a réellement construite, et l'erreur qu'un apprenant fait vraiment.
 *
 * Le hasard est neutralisé partout où l'ordre compte.
 */

const A2: readonly Tense[] = [
  'indicativo.presente',
  'indicativo.perfecto',
  'indicativo.indefinido',
  'indicativo.imperfecto',
  'indicativo.futuro',
  'indicativo.condicional',
]

const first = () => 0

function cell(lemma: string, tense: Tense, person: Person): Form {
  const form = conjugate(lemma, tense, person)
  if (form === null) throw new Error(`${lemma} n’a pas de ${tense} à la ${person}e personne`)
  return form
}

function values(lemma: string, tense: Tense, person: Person, tenses = A2): string[] {
  return distractorsFor(lemma, tense, person, cell(lemma, tense, person), {
    tenses,
    random: first,
  }).map((distractor) => distractor.value)
}

describe('distracteurs', () => {
  it('propose la forme régulière que le verbe aurait dû suivre', () => {
    // L'erreur numéro un sur `pensar` : appliquer la règle et manquer la
    // diphtongaison. C'est exactement ce que le QCM doit forcer à trancher.
    const distractors = distractorsFor(
      'pensar',
      'indicativo.presente',
      'yo',
      cell('pensar', 'indicativo.presente', 'yo'),
      { tenses: A2, random: first },
    )

    const regular = distractors.find((distractor) => distractor.kind === 'regular')
    expect(regular?.value).toBe('penso')
    // Le moteur sait dire pourquoi la forme dévie ; la correction s'en sert.
    expect(regular?.reason).toContain('diphtongaison')
  })

  it('donne la forme régulière en premier, sans la soumettre au hasard', () => {
    // La plus instructive des trois : la tirer au sort la perdrait une fois sur
    // deux, et avec elle tout l'intérêt de la question.
    for (let seed = 1; seed < 10; seed++) {
      const random = seeded(seed)
      const distractors = distractorsFor(
        'tener',
        'indicativo.indefinido',
        'yo',
        cell('tener', 'indicativo.indefinido', 'yo'),
        { tenses: A2, random },
      )
      expect(distractors[0]?.value, `graine ${seed}`).toBe('tení')
    }
  })

  it('n’oppose pas une forme suppletive à sa version régulière', () => {
    // `ser` régulier donnerait `ses`, que personne n'a jamais écrit pour `eres` :
    // une suppletion n'a aucun lien avec l'infinitif, donc la règle du groupe
    // n'a jamais été un candidat. C'est du bruit, pas une erreur plausible.
    const produced = values('ser', 'indicativo.presente', 'tu')

    expect(produced).not.toContain('ses')
    // Le verbe reste interrogeable pour autant : ce sont ses vraies formes qui
    // servent de leurres.
    expect(produced.length).toBe(3)
  })

  it('compte l’adaptation graphique comme une erreur plausible', () => {
    // Ce n'est pas de l'irrégularité, mais c'est bien ce qu'on écrit : la règle
    // du `-car` est justement celle qu'on oublie.
    expect(values('buscar', 'indicativo.indefinido', 'yo')).toContain('buscé')
  })

  it('oppose la même forme à une autre personne', () => {
    const distractors = distractorsFor(
      'hablar',
      'indicativo.indefinido',
      'el',
      cell('hablar', 'indicativo.indefinido', 'el'),
      { tenses: A2, random: first },
    )

    // Sans distracteur de personne, on répond en reconnaissant le verbe.
    expect(distractors.some((distractor) => distractor.kind === 'person')).toBe(true)
  })

  it('oppose le même verbe à un autre temps', () => {
    // La discrimination que la production ne travaille pas : au drill, on écrit
    // ce qu'on a en tête sans jamais voir l'autre temps à côté.
    const distractors = distractorsFor(
      'hablar',
      'indicativo.indefinido',
      'el',
      cell('hablar', 'indicativo.indefinido', 'el'),
      { tenses: A2, random: first },
    )

    const other = distractors.find((distractor) => distractor.kind === 'tense')
    expect(other).toBeDefined()
    // La forme citée est bien celle du verbe, à la même personne, à un temps du
    // pool — pas une forme inventée pour faire nombre.
    expect(A2.some((tense) => conjugate('hablar', tense, 'el')?.value === other!.value)).toBe(true)
  })

  it('ne mélange pas les temps simples et les temps composés', () => {
    // `he pensado` contre `pienso` se tranche en comptant les mots : un
    // distracteur qu'on écarte sans conjuguer rend la question plus facile.
    for (const value of values('pensar', 'indicativo.presente', 'yo')) {
      expect(value.includes(' '), value).toBe(false)
    }
    for (const value of values('comer', 'indicativo.perfecto', 'yo')) {
      expect(value.includes(' '), value).toBe(true)
    }
  })

  it('ne produit aucun distracteur de temps sans liste de temps', () => {
    // Le module ne connaît pas le curriculum : plutôt que de deviner, il se
    // limite aux personnes. Un temps jamais rencontré ferait un mauvais leurre.
    const distractors = distractorsFor(
      'hablar',
      'indicativo.indefinido',
      'el',
      cell('hablar', 'indicativo.indefinido', 'el'),
      { random: first },
    )
    expect(distractors.every((distractor) => distractor.kind !== 'tense')).toBe(true)
  })

  it('n’accepte jamais une réponse qui serait correcte', () => {
    for (const lemma of ['hablar', 'tener', 'ser', 'ir', 'pedir', 'buscar', 'volver']) {
      for (const tense of A2) {
        for (const person of ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'] as Person[]) {
          const form = conjugate(lemma, tense, person)
          if (form === null) continue

          const accepted = new Set([form.value, ...form.alternatives])
          for (const distractor of distractorsFor(lemma, tense, person, form, {
            tenses: A2,
            random: first,
          })) {
            expect(accepted.has(distractor.value), `${lemma} ${tense} ${person}`).toBe(false)
          }
        }
      }
    }
  })

  it('ne propose jamais deux fois la même forme', () => {
    // `hablamos` est à la fois le présent et le passé simple : sans dédoublonnage,
    // le QCM offrirait deux cases identiques, dont l'une serait juste.
    for (const lemma of ['hablar', 'vivir', 'ser', 'llover']) {
      for (const tense of A2) {
        for (const person of ['yo', 'el', 'nosotros'] as Person[]) {
          if (conjugate(lemma, tense, person) === null) continue
          const produced = values(lemma, tense, person)
          expect(new Set(produced).size, `${lemma} ${tense} ${person}`).toBe(produced.length)
        }
      }
    }
  })

  it('ne propose jamais une case qui n’existe pas', () => {
    // `llover` n'a que la troisième personne du singulier. Inventer `llovemos`
    // pour faire nombre enseignerait une forme que l'app refuse par ailleurs.
    const produced = values('llover', 'indicativo.presente', 'el')

    expect(produced.length).toBeGreaterThan(0)
    for (const value of produced) {
      expect(value.startsWith('llov') || value.startsWith('llueve'), value).toBe(true)
    }
  })

  it('en produit autant qu’on lui en demande, et pas plus', () => {
    expect(values('hablar', 'indicativo.presente', 'yo')).toHaveLength(3)

    const two = distractorsFor(
      'hablar',
      'indicativo.presente',
      'yo',
      cell('hablar', 'indicativo.presente', 'yo'),
      { tenses: A2, count: 2, random: first },
    )
    expect(two).toHaveLength(2)
  })

  it('accorde l’article du temps cité', () => {
    // « le imparfait » dans une correction décrédibilise ce qu'elle enseigne.
    const distractors = distractorsFor(
      'hablar',
      'indicativo.presente',
      'yo',
      cell('hablar', 'indicativo.presente', 'yo'),
      { tenses: ['indicativo.presente', 'indicativo.imperfecto'], random: first },
    )
    expect(distractors.find((distractor) => distractor.kind === 'tense')?.label).toBe('l’imparfait')
  })

  it('ne rend que des formes que le moteur a construites', () => {
    // Le garde-fou du module : aucune forme n'est fabriquée ici, elles sortent
    // toutes de `conjugate`. Une mauvaise réponse inventée serait pire qu'un
    // exercice absent — c'est la même exigence que pour les formes correctes.
    for (const tense of A2) {
      for (const distractor of distractorsFor('volver', tense, 'el', cell('volver', tense, 'el'), {
        tenses: A2,
        random: first,
      })) {
        expect(builtByEngine('volver', distractor.value), `${tense} → ${distractor.value}`).toBe(
          true,
        )
      }
    }
  })
})

/** Vrai si le moteur produit cette forme quelque part dans le paradigme, ou sa version régulière. */
function builtByEngine(lemma: string, value: string): boolean {
  const persons: Person[] = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos']

  return A2.some((tense) =>
    persons.some((person) => {
      const form = conjugate(lemma, tense, person)
      return form !== null && (form.value === value || form.regular === value)
    }),
  )
}

/** Hasard déterministe : un générateur congruentiel suffit et rend les tests stables. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}
