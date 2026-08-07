/**
 * Vocabulaire du moteur de conjugaison. Voir PLAN.md §2 pour la définition métier
 * de chaque terme (lemma, model, cell, irregularity…).
 *
 * Ce module est pur : aucune dépendance à Vue, au DOM ou à la persistance.
 */

/** Les six personnes. L'ordre est celui des tableaux de conjugaison et ne change jamais. */
export const PERSONS = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'] as const
export type Person = (typeof PERSONS)[number]

/** Étiquettes affichées. `él` couvre aussi `usted`, `ellos` aussi `ustedes`. */
export const PERSON_LABELS: Record<Person, string> = {
  yo: 'yo',
  tu: 'tú',
  el: 'él / ella / usted',
  nosotros: 'nosotros',
  vosotros: 'vosotros',
  ellos: 'ellos / ellas / ustedes',
}

/** Temps simples : une seule forme verbale, construite radical + terminaison. */
export const SIMPLE_TENSES = [
  'indicativo.presente',
  'indicativo.imperfecto',
  'indicativo.indefinido',
  'indicativo.futuro',
  'indicativo.condicional',
  'subjuntivo.presente',
  'subjuntivo.imperfecto',
  'subjuntivo.futuro',
  'imperativo.afirmativo',
  'imperativo.negativo',
] as const
export type SimpleTense = (typeof SIMPLE_TENSES)[number]

/** Temps composés : auxiliaire `haber` conjugué + participe passé. */
export const COMPOUND_TENSES = [
  'indicativo.perfecto',
  'indicativo.pluscuamperfecto',
  'indicativo.anterior',
  'indicativo.futuroPerfecto',
  'indicativo.condicionalPerfecto',
  'subjuntivo.perfecto',
  'subjuntivo.pluscuamperfecto',
] as const
export type CompoundTense = (typeof COMPOUND_TENSES)[number]

export const TENSES = [...SIMPLE_TENSES, ...COMPOUND_TENSES] as const
export type Tense = SimpleTense | CompoundTense

/** Le temps composé et le temps simple qui fournit l'auxiliaire `haber`. */
export const COMPOUND_AUXILIARY: Record<CompoundTense, SimpleTense> = {
  'indicativo.perfecto': 'indicativo.presente',
  'indicativo.pluscuamperfecto': 'indicativo.imperfecto',
  'indicativo.anterior': 'indicativo.indefinido',
  'indicativo.futuroPerfecto': 'indicativo.futuro',
  'indicativo.condicionalPerfecto': 'indicativo.condicional',
  'subjuntivo.perfecto': 'subjuntivo.presente',
  'subjuntivo.pluscuamperfecto': 'subjuntivo.imperfecto',
}

export function isCompoundTense(tense: Tense): tense is CompoundTense {
  return tense in COMPOUND_AUXILIARY
}

/** Noms français des temps, pour l'interface et les consignes d'exercice. */
export const TENSE_LABELS: Record<Tense, string> = {
  'indicativo.presente': 'présent de l’indicatif',
  'indicativo.imperfecto': 'imparfait',
  'indicativo.indefinido': 'passé simple (pretérito indefinido)',
  'indicativo.futuro': 'futur simple',
  'indicativo.condicional': 'conditionnel présent',
  'subjuntivo.presente': 'présent du subjonctif',
  'subjuntivo.imperfecto': 'imparfait du subjonctif',
  'subjuntivo.futuro': 'futur du subjonctif',
  'imperativo.afirmativo': 'impératif affirmatif',
  'imperativo.negativo': 'impératif négatif',
  'indicativo.perfecto': 'passé composé (pretérito perfecto)',
  'indicativo.pluscuamperfecto': 'plus-que-parfait',
  'indicativo.anterior': 'passé antérieur',
  'indicativo.futuroPerfecto': 'futur antérieur',
  'indicativo.condicionalPerfecto': 'conditionnel passé',
  'subjuntivo.perfecto': 'passé du subjonctif',
  'subjuntivo.pluscuamperfecto': 'plus-que-parfait du subjonctif',
}

/** Les trois groupes, déterminés par la terminaison de l'infinitif. */
export type Conjugation = 'ar' | 'er' | 'ir'

/**
 * Nature d'un écart entre la forme réelle et la forme régulière attendue.
 * C'est ce que l'interface surligne et explique.
 */
export type IrregularityKind =
  /** Diphtongaison sous accent tonique : pensar → pienso. */
  | 'diphthong'
  /** Affaiblissement du radical : pedir → pido, dormir → durmiendo. */
  | 'weakening'
  /** Modification purement graphique pour conserver le son : buscar → busqué. */
  | 'orthographic'
  /** Radical de prétérit fort, à terminaisons atones : tener → tuve. */
  | 'strongPreterite'
  /** Radical syncopé du futur et du conditionnel : tener → tendré. */
  | 'syncopatedFuture'
  /** Première personne du singulier propre : hacer → hago, conocer → conozco. */
  | 'irregularFirstPerson'
  /** Participe ou gérondif irrégulier : escribir → escrito, ir → yendo. */
  | 'irregularNonFinite'
  /** Impératif de deuxième personne irrégulier : tener → ten. */
  | 'irregularImperative'
  /** Forme suppletive, sans lien avec l'infinitif : ir → fui. */
  | 'suppletive'

/** Un écart localisé dans la forme, pour pouvoir le surligner. */
export interface Irregularity {
  kind: IrregularityKind
  /** Explication courte en français, affichée sous la forme corrigée. */
  explanation: string
  /** Bornes [début, fin[ du segment irrégulier dans `Form.value`. */
  span: [number, number]
}

/** Le résultat d'une conjugaison : la forme, ses variantes, et pourquoi elle dévie. */
export interface Form {
  /** Forme de référence, celle attendue d'un apprenant. */
  value: string
  /**
   * Autres formes également correctes : `-ra`/`-se` au subjonctif imparfait,
   * participes doubles (`imprimido`/`impreso`). Toujours acceptées en exercice.
   */
  alternatives: string[]
  /** Ce qu'aurait donné la conjugaison régulière du groupe. Sert à expliquer l'écart. */
  regular: string
  irregularities: Irregularity[]
}

/** Cellule vide : personne inexistante (yo à l'impératif) ou verbe défectif. */
export type MaybeForm = Form | null
