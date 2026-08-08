import { joinWithOrthography } from './orthography'
import type { Conjugation, IrregularityKind, Person, Tense } from './types'

export interface StemContext {
  infinitive: string
  /** Infinitif privé de sa terminaison de groupe : `pensar` → `pens`. */
  stem: string
  conjugation: Conjugation
  /**
   * Applique ou non les adaptations graphiques. Désactivé pour construire la forme
   * régulière de référence, afin que le passage de `buscé` à `busqué` apparaisse
   * comme un écart explicable et non comme un fait acquis.
   */
  orthography: boolean
  /**
   * Ce que le verbe a de plus que le verbe de base dont il dérive : `obtener` →
   * `ob`, `descomponer` → `descom`. Vide pour un verbe non dérivé.
   *
   * Un modèle écrit ses formes figées pour son verbe de base — `tengo`, `hecho`,
   * `hizo`. Le préfixe est ce qui permet de les rendre à ses dérivés sans les
   * réécrire : c'est toute la rentabilité de la dérivation.
   */
  prefix: string
}

export type StemFn = (ctx: StemContext) => string

/**
 * Emplacements du paradigme où un modèle peut se substituer à la règle régulière.
 * Chacun correspond à une vraie articulation de la conjugaison espagnole, pas à
 * un découpage arbitraire — c'est ce qui permet à un modèle de tenir en trois lignes.
 */
export type Slot =
  | 'orthographic'
  | 'present'
  | 'yo'
  | 'subjunctive'
  | 'imperfect'
  | 'preterite'
  | 'future'
  | 'gerundio'
  | 'participio'
  | 'imperativeTu'
  | 'forms'

export interface Reason {
  kind: IrregularityKind
  explanation: string
  /**
   * Segment à surligner, quand la comparaison brute avec la forme régulière
   * désignerait moins que ce qu'il faut montrer. Entre `penso` et `pienso`, seul
   * le `i` est ajouté ; ce qu'il faut faire voir à l'apprenant, c'est `ie`.
   */
  segment?: string
}

/**
 * Un patron de conjugaison. Un modèle décrit une *transformation du radical*, pas
 * un verbe : `pensar` sert de nom au modèle que suivent aussi `empezar`, `cerrar`,
 * `perder`… Les verbes réellement suppletifs (`ser`, `ir`) sont des modèles à un
 * seul verbe, qui listent leurs formes.
 */
export interface Model {
  id: string
  /** Verbe qui donne son nom au modèle. */
  example: string
  /** Description française du patron, affichée dans l'app. */
  label: string

  /** Radical du présent sous accent tonique : yo, tú, él, ellos. */
  presentStressedStem?: StemFn
  /** Radical du présent hors accent : nosotros, vosotros. */
  presentStem?: StemFn
  /** Forme complète de la première personne du singulier du présent. */
  yo?: StemFn
  /** Radical du subjonctif présent. Par défaut, la forme `yo` privée de son `-o`. */
  subjunctiveStem?: StemFn
  /** Radical du subjonctif présent à nosotros/vosotros : `dormir` → `durmamos`. */
  subjunctiveNosStem?: StemFn
  imperfectStem?: StemFn
  preteriteStem?: StemFn
  /** Prétérit fort : radical propre et terminaisons atones (`tuve`, et non `tení`). */
  strongPreterite?: boolean
  /** Radical de 3e personne du prétérit : `dormir` → `durmió`, `durmieron`. */
  preteriteThirdStem?: StemFn
  /** Radical du futur *et* du conditionnel — les deux sont toujours solidaires. */
  futureStem?: StemFn
  gerundio?: StemFn
  participio?: StemFn
  /** Participes doubles : `imprimir` → `imprimido` / `impreso`. */
  participioAlternatives?: StemFn[]
  imperativeTu?: StemFn

  /** Formes suppletives, clé `${table}:${person}`. */
  forms?: Record<string, string>
  /** Autres formes acceptables pour une cellule, même clé que `forms`. */
  alternativeForms?: Record<string, string[]>

  /**
   * Cellules que ce verbe n'a pas. Renvoie `true` quand la case n'existe pas.
   *
   * Un verbe défectif n'est pas un verbe irrégulier : ses formes absentes ne sont
   * pas fautives, elles sont inusitées. `llover` n'a pas de première personne —
   * la pluie n'est le sujet de personne — et `soler` n'a ni futur ni impératif.
   * Une case vide est plus honnête qu'une forme correctement construite que
   * personne n'emploie, et que l'apprenant retiendrait à tort.
   */
  defective?: (tense: Tense, person: Person) => boolean

  /** Nature de l'écart, par emplacement. `default` couvre les emplacements non listés. */
  reasons?: Partial<Record<Slot | 'default', Reason>>
}

/** Nature par défaut de l'écart produit par chaque emplacement. */
export const DEFAULT_REASONS: Record<Slot, Reason> = {
  orthographic: { kind: 'orthographic', explanation: 'adaptation graphique du radical' },
  present: { kind: 'diphthong', explanation: 'radical modifié au présent' },
  yo: { kind: 'irregularFirstPerson', explanation: 'première personne irrégulière' },
  subjunctive: { kind: 'weakening', explanation: 'radical propre au subjonctif' },
  imperfect: { kind: 'suppletive', explanation: 'imparfait irrégulier' },
  preterite: { kind: 'strongPreterite', explanation: 'prétérit fort' },
  future: {
    kind: 'syncopatedFuture',
    explanation: 'radical syncopé au futur et au conditionnel',
  },
  gerundio: { kind: 'irregularNonFinite', explanation: 'gérondif irrégulier' },
  participio: { kind: 'irregularNonFinite', explanation: 'participe irrégulier' },
  imperativeTu: { kind: 'irregularImperative', explanation: 'impératif de tú irrégulier' },
  forms: { kind: 'suppletive', explanation: 'forme irrégulière' },
}

// ---------------------------------------------------------------------------
// Fabriques de radicaux
// ---------------------------------------------------------------------------

/**
 * Remplace la *dernière* occurrence d'une voyelle du radical. C'est toujours la
 * dernière qui porte l'accent tonique, donc la seule qui diphtongue :
 * `comenzar` → `comienzo`, et non `ciomenzo`.
 */
function replaceLastVowel(stem: string, from: string, to: string): string {
  const index = stem.lastIndexOf(from)
  return index < 0 ? stem : stem.slice(0, index) + to + stem.slice(index + from.length)
}

const alternate =
  (from: string, to: string): StemFn =>
  ({ stem }) =>
    replaceLastVowel(stem, from, to)

/**
 * Gérondif d'un radical affaibli, adaptations graphiques comprises.
 *
 * Le i de `-iendo` n'est pas toujours écrit : après ñ, ll ou ch, déjà mouillés,
 * il disparaît — `reñir` → `riñendo`, et non `*riñiendo`. C'est la règle
 * ordinaire de rencontre du radical et de la terminaison, et la lui appliquer
 * évite de la redire dans chaque modèle.
 */
const weakenedGerund =
  (from: string, to: string): StemFn =>
  (ctx) => {
    const stem = replaceLastVowel(ctx.stem, from, to)
    return joinWithOrthography(ctx.conjugation, stem, 'iendo', ctx.stem).value
  }

/**
 * Rend au verbe courant ce que le modèle a figé pour son verbe de base : `tener`
 * donne `tengo`, donc `obtener` donne `obtengo`. La morphologie irrégulière est
 * rigoureusement la même, seul le préfixe s'ajoute.
 *
 * L'accentuation écrite qu'un préfixe peut réclamer — `ten` → `obtén` — n'est
 * pas décidée ici : elle dépend de la forme finie, que le modèle ne connaît pas
 * quand il ne fournit qu'un radical. C'est le moteur qui tranche, une fois la
 * forme complète (`accentIfBaseIsMonosyllable`).
 */
export function fixedForm(ctx: StemContext, value: string): string {
  return ctx.prefix + value
}

/** Valeur figée par le modèle pour son verbe de base — radical ou forme entière. */
const literal =
  (value: string): StemFn =>
  (ctx) =>
    fixedForm(ctx, value)

const plain: StemFn = ({ stem }) => stem

const suffix =
  (append: string): StemFn =>
  ({ stem }) =>
    stem + append

/** Construit la table `forms` d'un temps entier à partir des six formes. */
function table(prefix: string, forms: readonly [string, string, string, string, string, string]) {
  const persons: Person[] = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos']
  return Object.fromEntries(persons.map((person, index) => [`${prefix}:${person}`, forms[index]!]))
}

const DIPHTHONG = (from: string, to: string): Reason => ({
  kind: 'diphthong',
  explanation: `diphtongaison ${from} → ${to} sur la syllabe tonique`,
  segment: to,
})

const WEAKENING = (from: string, to: string): Reason => ({
  kind: 'weakening',
  explanation: `affaiblissement ${from} → ${to} du radical`,
  segment: to,
})

// ---------------------------------------------------------------------------
// Modèles réguliers
// ---------------------------------------------------------------------------

const regular = (conjugation: Conjugation): Model => ({
  id: `regular-${conjugation}`,
  example: conjugation === 'ar' ? 'hablar' : conjugation === 'er' ? 'comer' : 'vivir',
  label: `verbes en -${conjugation} réguliers`,
})

export const REGULAR_MODELS: Record<Conjugation, Model> = {
  ar: regular('ar'),
  er: regular('er'),
  ir: regular('ir'),
}

// ---------------------------------------------------------------------------
// Familles à alternance vocalique
// ---------------------------------------------------------------------------

/**
 * Diphtongue la dernière voyelle du radical, tréma compris.
 *
 * Le u de `ue` doit rester prononcé quand la diphtongue vient se poser derrière
 * un g : sans tréma, `gue` se lirait [ge] et le u disparaîtrait. D'où
 * `avergonzar` → `avergüenzo`, `degollar` → `degüello`, `agorar` → `agüero`.
 */
const diphthongize =
  (from: string, to: string): StemFn =>
  ({ stem }) => {
    const index = stem.lastIndexOf(from)
    if (index < 0) return stem
    // Le tréma ne concerne que le u que l'on vient d'écrire, jamais un `gu`
    // hérité de l'infinitif : `colgar` → `cuelgo` n'en prend pas, son u étant
    // déjà muet et suivi d'un o.
    const inserted = to.startsWith('ue') && stem[index - 1] === 'g' ? `ü${to.slice(1)}` : to
    return stem.slice(0, index) + inserted + stem.slice(index + from.length)
  }

/**
 * Diphtongaison simple : la voyelle du radical se dédouble sous l'accent tonique,
 * donc partout sauf à nosotros et vosotros. C'est la famille la plus peuplée de
 * l'espagnol, et la plus rentable à enseigner comme un patron unique.
 */
const diphthongModel = (id: string, example: string, from: string, to: string): Model => ({
  id,
  example,
  label: `${from} → ${to} sous l'accent tonique (comme ${example})`,
  presentStressedStem: diphthongize(from, to),
  subjunctiveNosStem: plain,
  reasons: { present: DIPHTHONG(from, to), subjunctive: DIPHTHONG(from, to) },
})

/**
 * Verbes en -ir à double alternance : diphtongaison sous l'accent, mais
 * affaiblissement partout où la terminaison contient un i atone — subjonctif de
 * nosotros/vosotros, troisième personne du prétérit, gérondif.
 */
const doubleAlternationModel = (
  id: string,
  example: string,
  from: string,
  stressed: string,
  weak: string,
): Model => ({
  id,
  example,
  label: `${from} → ${stressed} sous l'accent, ${from} → ${weak} ailleurs (comme ${example})`,
  presentStressedStem: alternate(from, stressed),
  subjunctiveNosStem: alternate(from, weak),
  preteriteThirdStem: alternate(from, weak),
  gerundio: weakenedGerund(from, weak),
  reasons: {
    present: DIPHTHONG(from, stressed),
    subjunctive: WEAKENING(from, weak),
    preterite: WEAKENING(from, weak),
    gerundio: WEAKENING(from, weak),
  },
})

/** Affaiblissement pur des -ir : `pedir` → `pido`, `pidamos`, `pidió`, `pidiendo`. */
const weakeningModel = (id: string, example: string, from: string, to: string): Model => ({
  id,
  example,
  label: `${from} → ${to} du radical (comme ${example})`,
  presentStressedStem: alternate(from, to),
  preteriteThirdStem: alternate(from, to),
  gerundio: weakenedGerund(from, to),
  reasons: {
    present: WEAKENING(from, to),
    preterite: WEAKENING(from, to),
    gerundio: WEAKENING(from, to),
  },
})

// ---------------------------------------------------------------------------
// Modèles individuels
// ---------------------------------------------------------------------------

const ser: Model = {
  id: 'ser',
  example: 'ser',
  label: 'entièrement irrégulier, à radicaux multiples',
  forms: {
    ...table('indicativo.presente', ['soy', 'eres', 'es', 'somos', 'sois', 'son']),
    ...table('indicativo.imperfecto', ['era', 'eras', 'era', 'éramos', 'erais', 'eran']),
    ...table('indicativo.indefinido', ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron']),
  },
  subjunctiveStem: literal('se'),
  gerundio: literal('siendo'),
  participio: literal('sido'),
  imperativeTu: literal('sé'),
  reasons: { default: { kind: 'suppletive', explanation: 'forme suppletive de ser' } },
}

const ir: Model = {
  id: 'ir',
  example: 'ir',
  label: 'entièrement irrégulier ; son prétérit est celui de ser',
  forms: {
    ...table('indicativo.presente', ['voy', 'vas', 'va', 'vamos', 'vais', 'van']),
    ...table('indicativo.imperfecto', ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban']),
    ...table('indicativo.indefinido', ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron']),
  },
  subjunctiveStem: literal('vay'),
  gerundio: literal('yendo'),
  imperativeTu: literal('ve'),
  reasons: { default: { kind: 'suppletive', explanation: 'forme suppletive de ir' } },
}

const haber: Model = {
  id: 'haber',
  example: 'haber',
  label: 'auxiliaire des temps composés, entièrement irrégulier',
  forms: table('indicativo.presente', ['he', 'has', 'ha', 'hemos', 'habéis', 'han']),
  // `hay` est la forme impersonnelle — « il y a » — et non l'auxiliaire. Les deux
  // occupent la même case et un apprenant doit connaître les deux.
  alternativeForms: { 'indicativo.presente:el': ['hay'] },
  subjunctiveStem: literal('hay'),
  preteriteStem: literal('hub'),
  strongPreterite: true,
  futureStem: literal('habr'),
  imperativeTu: literal('he'),
  reasons: { subjunctive: { kind: 'suppletive', explanation: 'subjonctif en hay-' } },
}

const estar: Model = {
  id: 'estar',
  example: 'estar',
  label: 'accent tonique irrégulier au présent, prétérit fort en estuv-',
  forms: {
    ...table('indicativo.presente', ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están']),
    ...table('subjuntivo.presente', ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén']),
  },
  preteriteStem: literal('estuv'),
  strongPreterite: true,
  imperativeTu: literal('está'),
}

const dar: Model = {
  id: 'dar',
  example: 'dar',
  label: 'prend les terminaisons des -er au prétérit',
  forms: {
    ...table('indicativo.presente', ['doy', 'das', 'da', 'damos', 'dais', 'dan']),
    ...table('subjuntivo.presente', ['dé', 'des', 'dé', 'demos', 'deis', 'den']),
    ...table('indicativo.indefinido', ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron']),
  },
}

const ver: Model = {
  id: 'ver',
  example: 'ver',
  label: 'radical ve- conservé, participe irrégulier',
  yo: literal('veo'),
  imperfectStem: literal('ve'),
  forms: {
    'indicativo.presente:vosotros': 'veis',
    ...table('indicativo.indefinido', ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron']),
  },
  participio: literal('visto'),
}

const tener: Model = {
  id: 'tener',
  example: 'tener',
  label: 'yo en -go, diphtongaison e → ie, prétérit fort tuv-, futur syncopé tendr-',
  yo: literal('tengo'),
  presentStressedStem: alternate('e', 'ie'),
  preteriteStem: literal('tuv'),
  strongPreterite: true,
  futureStem: literal('tendr'),
  imperativeTu: literal('ten'),
  reasons: { present: DIPHTHONG('e', 'ie') },
}

const venir: Model = {
  id: 'venir',
  example: 'venir',
  label: 'yo en -go, diphtongaison e → ie, prétérit fort vin-, futur syncopé vendr-',
  yo: literal('vengo'),
  presentStressedStem: alternate('e', 'ie'),
  preteriteStem: literal('vin'),
  strongPreterite: true,
  futureStem: literal('vendr'),
  gerundio: literal('viniendo'),
  imperativeTu: literal('ven'),
  reasons: { present: DIPHTHONG('e', 'ie') },
}

/**
 * `hacer` est décrit à partir de son radical plutôt que par des formes figées,
 * pour que `satisfacer` — qui n'est pas un `hacer` préfixé, mais un composé du
 * même verbe latin — puisse suivre exactement le même modèle : `satisfago`,
 * `satisfice`, `satisfaré`, `satisfecho`.
 */
const hacer: Model = {
  id: 'hacer',
  example: 'hacer',
  label: 'yo en -go, prétérit fort hic-, futur syncopé har-, participe hecho',
  yo: ({ stem }) => `${stem.slice(0, -1)}go`,
  // `hizo` et non `hico` : le c devient z devant o pour garder le son. C'est la
  // règle graphique ordinaire, appliquée par `join` — rien à inscrire ici.
  preteriteStem: ({ stem }) => replaceLastVowel(stem, 'a', 'i'),
  strongPreterite: true,
  futureStem: ({ stem }) => `${stem.slice(0, -1)}r`,
  participio: ({ stem }) => `${replaceLastVowel(stem, 'a', 'e').slice(0, -1)}cho`,
  imperativeTu: ({ stem }) => `${stem.slice(0, -1)}z`,
}

/**
 * `bendecir` et `maldecir` suivent `decir` au présent et au prétérit, mais ont
 * refait leur futur et leur participe sur le modèle régulier : `bendeciré` et non
 * `*bendiré`, `bendecido` et non `*bendicho`. `bendito` ne survit que comme adjectif.
 */
const bendecir: Model = {
  id: 'bendecir',
  example: 'bendecir',
  label: 'comme decir au présent et au prétérit, mais futur et participe réguliers',
  yo: ({ stem }) => `${replaceLastVowel(stem, 'e', 'i').slice(0, -1)}go`,
  presentStressedStem: alternate('e', 'i'),
  preteriteStem: ({ stem }) => `${replaceLastVowel(stem, 'e', 'i').slice(0, -1)}j`,
  strongPreterite: true,
  gerundio: (ctx) => `${replaceLastVowel(ctx.stem, 'e', 'i')}iendo`,
  reasons: { present: WEAKENING('e', 'i') },
}

const decir: Model = {
  id: 'decir',
  example: 'decir',
  label: 'yo en -go, affaiblissement e → i, prétérit fort dij-, futur syncopé dir-',
  yo: literal('digo'),
  presentStressedStem: alternate('e', 'i'),
  preteriteStem: literal('dij'),
  strongPreterite: true,
  futureStem: literal('dir'),
  gerundio: literal('diciendo'),
  participio: literal('dicho'),
  // `decir` fait `di`, mais aucun de ses dérivés ne fait `*contradí` : ils
  // reprennent la troisième personne du présent, `contradice`, `predice`,
  // `desdice`. Le monosyllabe `di` est une survivance propre au verbe simple.
  imperativeTu: (ctx) => (ctx.prefix === '' ? 'di' : `${ctx.prefix}dice`),
  reasons: { present: WEAKENING('e', 'i') },
}

const poder: Model = {
  id: 'poder',
  example: 'poder',
  label: 'diphtongaison o → ue, prétérit fort pud-, futur syncopé podr-',
  presentStressedStem: alternate('o', 'ue'),
  subjunctiveNosStem: plain,
  preteriteStem: literal('pud'),
  strongPreterite: true,
  futureStem: literal('podr'),
  gerundio: literal('pudiendo'),
  reasons: { present: DIPHTHONG('o', 'ue'), subjunctive: DIPHTHONG('o', 'ue') },
}

const poner: Model = {
  id: 'poner',
  example: 'poner',
  label: 'yo en -go, prétérit fort pus-, futur syncopé pondr-, participe puesto',
  yo: literal('pongo'),
  preteriteStem: literal('pus'),
  strongPreterite: true,
  futureStem: literal('pondr'),
  participio: literal('puesto'),
  imperativeTu: literal('pon'),
}

const querer: Model = {
  id: 'querer',
  example: 'querer',
  label: 'diphtongaison e → ie, prétérit fort quis-, futur syncopé querr-',
  presentStressedStem: alternate('e', 'ie'),
  subjunctiveNosStem: plain,
  preteriteStem: literal('quis'),
  strongPreterite: true,
  futureStem: literal('querr'),
  reasons: { present: DIPHTHONG('e', 'ie'), subjunctive: DIPHTHONG('e', 'ie') },
}

const saber: Model = {
  id: 'saber',
  example: 'saber',
  label: 'yo en sé, subjonctif en sep-, prétérit fort sup-, futur syncopé sabr-',
  yo: literal('sé'),
  subjunctiveStem: literal('sep'),
  preteriteStem: literal('sup'),
  strongPreterite: true,
  futureStem: literal('sabr'),
}

const caber: Model = {
  id: 'caber',
  example: 'caber',
  label: 'yo en quepo, prétérit fort cup-, futur syncopé cabr-',
  yo: literal('quepo'),
  preteriteStem: literal('cup'),
  strongPreterite: true,
  futureStem: literal('cabr'),
}

const salir: Model = {
  id: 'salir',
  example: 'salir',
  label: 'yo en -go, futur syncopé saldr-',
  yo: literal('salgo'),
  futureStem: literal('saldr'),
  imperativeTu: literal('sal'),
}

const traer: Model = {
  id: 'traer',
  example: 'traer',
  label: 'yo en -igo, prétérit fort traj-',
  yo: literal('traigo'),
  preteriteStem: literal('traj'),
  strongPreterite: true,
}

const oir: Model = {
  id: 'oir',
  example: 'oír',
  label: 'yo en -igo, y devant les terminaisons en o et e',
  yo: literal('oigo'),
  presentStressedStem: suffix('y'),
  reasons: { present: { kind: 'orthographic', explanation: 'y devant les voyelles fortes' } },
}

const caer: Model = {
  id: 'caer',
  example: 'caer',
  label: 'yo en -igo ; le reste suit les règles graphiques du radical en voyelle',
  yo: literal('caigo'),
}

const valer: Model = {
  id: 'valer',
  example: 'valer',
  label: 'yo en -go, futur syncopé valdr-',
  yo: literal('valgo'),
  futureStem: literal('valdr'),
}

const oler: Model = {
  id: 'oler',
  example: 'oler',
  label: 'o → ue sous l’accent, avec un h prosthétique : huelo',
  presentStressedStem: literal('huel'),
  subjunctiveNosStem: plain,
  reasons: {
    present: {
      kind: 'diphthong',
      explanation: 'diphtongaison o → ue, et h prosthétique car ue- ne peut ouvrir un mot',
      segment: 'hue',
    },
    subjunctive: {
      kind: 'diphthong',
      explanation: 'diphtongaison o → ue, et h prosthétique car ue- ne peut ouvrir un mot',
      segment: 'hue',
    },
  },
}

/**
 * `reír` cumule l'affaiblissement e → i et la rencontre de deux i, que
 * l'orthographe refuse : `ri` + `ió` ne donne pas `riyó` mais `rio`.
 */
const reir: Model = {
  id: 'reir',
  example: 'reír',
  label: 'affaiblissement e → i, et fusion des deux i au prétérit',
  presentStressedStem: alternate('e', 'í'),
  subjunctiveNosStem: alternate('e', 'i'),
  forms: {
    'indicativo.indefinido:el': 'rio',
    'indicativo.indefinido:ellos': 'rieron',
  },
  gerundio: (ctx) => `${replaceLastVowel(ctx.stem, 'e', 'i')}endo`,
  reasons: { present: WEAKENING('e', 'i'), subjunctive: WEAKENING('e', 'i') },
}

/**
 * `freír` suit `reír` mais garde deux participes : `frito`, qui a fini par
 * s'imposer, et `freído`, régulier et toujours correct. Les deux sont acceptés
 * en exercice.
 */
const freir: Model = {
  ...reir,
  id: 'freir',
  example: 'freír',
  label: 'comme reír, avec le participe irrégulier frito à côté de freído',
  // Les formes figées de `reír` sont écrites pour son propre radical : il faut
  // les redire ici, `freír` n'étant pas un `reír` préfixé.
  forms: {
    'indicativo.indefinido:el': 'frio',
    'indicativo.indefinido:ellos': 'frieron',
  },
  participio: literal('frito'),
  participioAlternatives: [(ctx) => `${ctx.stem}ído`],
}

/**
 * `errar` diphtongue comme `pensar`, mais un mot espagnol ne peut pas commencer
 * par `ie-` : la diphtongue s'écrit alors `ye-`. Même accident qu'à `oler` →
 * `huelo`, et pour la même raison — c'est la graphie qui s'adapte, pas le son.
 */
const errar: Model = {
  id: 'errar',
  example: 'errar',
  label: 'e → ie sous l’accent, écrit ye- en tête de mot : yerro',
  presentStressedStem: literal('yerr'),
  subjunctiveNosStem: plain,
  reasons: {
    present: {
      kind: 'diphthong',
      explanation: 'diphtongaison e → ie, écrite ye- car un mot ne peut commencer par ie-',
      segment: 'ye',
    },
    subjunctive: {
      kind: 'diphthong',
      explanation: 'diphtongaison e → ie, écrite ye- car un mot ne peut commencer par ie-',
      segment: 'ye',
    },
  },
}

const asir: Model = {
  id: 'asir',
  example: 'asir',
  label: 'yo en -go, et donc tout le subjonctif : asgo, asga',
  yo: literal('asgo'),
}

const andar: Model = {
  id: 'andar',
  example: 'andar',
  label: 'régulier partout sauf un prétérit fort anduv-',
  preteriteStem: literal('anduv'),
  strongPreterite: true,
}

const conocer: Model = {
  id: 'conocer',
  example: 'conocer',
  label: 'c → zc à la première personne, et donc dans tout le subjonctif',
  yo: (ctx) => `${ctx.stem.slice(0, -1)}zco`,
  reasons: {
    yo: { kind: 'irregularFirstPerson', explanation: 'c → zc devant o et a' },
  },
}

const conducir: Model = {
  id: 'conducir',
  example: 'conducir',
  label: 'c → zc à la première personne, et prétérit fort en -duj-',
  yo: (ctx) => `${ctx.stem.slice(0, -1)}zco`,
  preteriteStem: (ctx) => `${ctx.stem.slice(0, -1)}j`,
  strongPreterite: true,
  reasons: {
    yo: { kind: 'irregularFirstPerson', explanation: 'c → zc devant o et a' },
  },
}

const construir: Model = {
  id: 'construir',
  example: 'construir',
  label: 'les verbes en -uir intercalent un y devant les terminaisons en o, e et a',
  presentStressedStem: suffix('y'),
  reasons: {
    present: { kind: 'orthographic', explanation: 'y intercalé devant o, e et a' },
  },
}

const enviar: Model = {
  id: 'enviar',
  example: 'enviar',
  label: 'le i du radical porte l’accent tonique : envío, envías',
  presentStressedStem: alternate('i', 'í'),
  subjunctiveNosStem: plain,
  reasons: {
    present: { kind: 'orthographic', explanation: 'le i accentué devient tonique' },
    subjunctive: { kind: 'orthographic', explanation: 'le i accentué devient tonique' },
  },
}

const actuar: Model = {
  id: 'actuar',
  example: 'actuar',
  label: 'le u du radical porte l’accent tonique : actúo, actúas',
  presentStressedStem: alternate('u', 'ú'),
  subjunctiveNosStem: plain,
  reasons: {
    present: { kind: 'orthographic', explanation: 'le u accentué devient tonique' },
    subjunctive: { kind: 'orthographic', explanation: 'le u accentué devient tonique' },
  },
}

// ---------------------------------------------------------------------------
// Verbes défectifs
// ---------------------------------------------------------------------------

/**
 * Verbes météorologiques : ce qui pleut ou neige n'est le sujet de personne, et
 * le verbe reste à la troisième personne du singulier. La langue admet un pluriel
 * figuré — « llueven críticas » — mais l'enseigner à un débutant reviendrait à lui
 * faire apprendre une exception littéraire avant la règle.
 */
const impersonal = (tense: Tense, person: Person): boolean =>
  person !== 'el' || tense.startsWith('imperativo.')

/**
 * Verbes dont le sujet est nécessairement une chose : ce qui concerne, atteint
 * ou incombe. Ils gardent les deux troisièmes personnes — une chose ou plusieurs
 * — mais on ne s'adresse pas à elles, d'où l'absence d'impératif.
 */
const thirdPersonOnly = (tense: Tense, person: Person): boolean =>
  (person !== 'el' && person !== 'ellos') || tense.startsWith('imperativo.')

/** Défectivité exprimée par la liste des temps qui, eux, existent. */
const onlyTenses = (...allowed: Tense[]) => {
  const set = new Set<Tense>(allowed)
  return (tense: Tense): boolean => !set.has(tense)
}

/** Greffe une défectivité sur un modèle existant, sans toucher à sa morphologie. */
const defectiveModel = (
  id: string,
  base: Model,
  label: string,
  defective: NonNullable<Model['defective']>,
): Model => ({ ...base, id, example: id, label, defective })

const llover = defectiveModel(
  'llover',
  diphthongModel('llover', 'llover', 'o', 'ue'),
  'o → ue sous l’accent ; impersonnel, seulement à la troisième personne du singulier',
  impersonal,
)

/**
 * `concernir` diphtongue comme `pensar`, mais ne se conjugue qu'à la troisième
 * personne : une affaire concerne quelqu'un, personne ne « concerne ». Il partage
 * cette défectivité avec `atañer` et `incumbir`.
 */
const concernir = defectiveModel(
  'concernir',
  diphthongModel('concernir', 'concernir', 'e', 'ie'),
  'e → ie sous l’accent ; défectif, limité aux troisièmes personnes',
  thirdPersonOnly,
)

const nevar = defectiveModel(
  'nevar',
  diphthongModel('nevar', 'nevar', 'e', 'ie'),
  'e → ie sous l’accent ; impersonnel, seulement à la troisième personne du singulier',
  impersonal,
)

/**
 * `soler` ne s'emploie qu'aux temps qui décrivent une habitude installée. Il n'a
 * ni futur ni impératif : on n'ordonne pas d'avoir l'habitude, et une habitude à
 * venir se dit autrement. Le passé composé — « ha solido » — reste courant.
 */
const soler = defectiveModel(
  'soler',
  diphthongModel('soler', 'soler', 'o', 'ue'),
  'o → ue sous l’accent ; défectif, limité au présent, à l’imparfait et au passé composé',
  onlyTenses(
    'indicativo.presente',
    'indicativo.imperfecto',
    'indicativo.perfecto',
    'indicativo.pluscuamperfecto',
    'subjuntivo.presente',
    'subjuntivo.imperfecto',
  ),
)

/**
 * `abolir` n'existe qu'aux formes dont la terminaison commence par un i. Il perd
 * donc tout le subjonctif présent, et du présent de l'indicatif il ne garde que
 * `abolimos` et `abolís` — d'où l'usage de remplacer les cases manquantes par
 * `derogar` ou `suprimir`.
 */
const abolir: Model = {
  id: 'abolir',
  example: 'abolir',
  label: 'défectif : seules subsistent les formes dont la terminaison commence par un i',
  defective: (tense, person) => {
    if (tense === 'indicativo.presente') return person !== 'nosotros' && person !== 'vosotros'
    if (tense === 'subjuntivo.presente' || tense === 'imperativo.negativo') return true
    // Reste de l'impératif : seul `abolid`, emprunté à l'infinitif, garde son i.
    if (tense === 'imperativo.afirmativo') return person !== 'vosotros'
    return false
  },
}

/** Verbes réguliers hormis leur participe : `escribir` → `escrito`. */
const irregularParticiple = (id: string, participle: string): Model => ({
  id: `participio-${id}`,
  example: id,
  label: `régulier, mais participe irrégulier en ${participle}`,
  participio: literal(participle),
})

/** Diphtongaison *et* participe irrégulier : `volver` → `vuelvo`, `vuelto`. */
/**
 * Diphtongaison, plus un participe en -to bâti sur le radical diphtongué dont la
 * dernière consonne tombe : `volver` → `vuelto`, `resolver` → `resuelto`.
 *
 * Le participe est calculé et non écrit en dur, parce que la famille dépasse les
 * dérivés de `volver` : `absolver` et `disolver` viennent de *solvere* et non de
 * *volvere*, mais font `absuelto` et `disuelto` par la même mécanique.
 */
const diphthongWithParticiple = (id: string, from: string, to: string): Model => {
  const stressed = diphthongize(from, to)
  return {
    ...diphthongModel(id, id, from, to),
    id,
    participio: (ctx) => `${stressed(ctx).slice(0, -1)}to`,
    label: `${from} → ${to} sous l'accent tonique, participe en -to (comme ${id})`,
  }
}

export const MODELS: Record<string, Model> = {
  'regular-ar': REGULAR_MODELS.ar,
  'regular-er': REGULAR_MODELS.er,
  'regular-ir': REGULAR_MODELS.ir,

  pensar: diphthongModel('pensar', 'pensar', 'e', 'ie'),
  contar: diphthongModel('contar', 'contar', 'o', 'ue'),
  jugar: diphthongModel('jugar', 'jugar', 'u', 'ue'),
  adquirir: diphthongModel('adquirir', 'adquirir', 'i', 'ie'),
  sentir: doubleAlternationModel('sentir', 'sentir', 'e', 'ie', 'i'),
  dormir: doubleAlternationModel('dormir', 'dormir', 'o', 'ue', 'u'),
  pedir: weakeningModel('pedir', 'pedir', 'e', 'i'),

  volver: diphthongWithParticiple('volver', 'o', 'ue'),
  morir: {
    ...doubleAlternationModel('morir', 'morir', 'o', 'ue', 'u'),
    id: 'morir',
    participio: literal('muerto'),
  },
  escribir: irregularParticiple('escribir', 'escrito'),
  abrir: irregularParticiple('abrir', 'abierto'),
  cubrir: irregularParticiple('cubrir', 'cubierto'),
  romper: irregularParticiple('romper', 'roto'),

  conocer,
  conducir,
  construir,
  enviar,
  actuar,

  ser,
  ir,
  haber,
  estar,
  dar,
  ver,
  tener,
  venir,
  hacer,
  decir,
  poder,
  poner,
  querer,
  saber,
  caber,
  salir,
  traer,
  oir,
  andar,
  caer,
  valer,
  oler,
  reir,
  freir,
  errar,
  asir,

  bendecir,

  llover,
  nevar,
  soler,
  abolir,
  concernir,
}

/**
 * Verbes suivant un modèle irrégulier. Les autres sont réguliers par défaut.
 * Cette table sera complétée en phase 2 avec les 1000 verbes les plus fréquents ;
 * on n'y met ici que les verbes couverts par les tests du moteur.
 */
export const VERB_MODELS: Record<string, string> = {
  // Suppletifs et très irréguliers
  ser: 'ser',
  ir: 'ir',
  haber: 'haber',
  estar: 'estar',
  dar: 'dar',
  ver: 'ver',
  tener: 'tener',
  venir: 'venir',
  hacer: 'hacer',
  decir: 'decir',
  poder: 'poder',
  poner: 'poner',
  querer: 'querer',
  saber: 'saber',
  caber: 'caber',
  salir: 'salir',
  traer: 'traer',
  oír: 'oir',
  andar: 'andar',
  caer: 'caer',
  valer: 'valer',
  oler: 'oler',
  reír: 'reir',
  freír: 'freir',
  errar: 'errar',
  asir: 'asir',
  yacer: 'conocer',
  placer: 'conocer',
  complacer: 'conocer',

  /*
   * Dérivés des verbes de base trop courts pour être dérivés sans risque : sous
   * quatre lettres, la coïncidence de suffixe l'emporte (`subir` finit par `ir`
   * sans rien devoir au verbe `ir`). Ils s'inscrivent donc un par un.
   */
  prever: 'ver',
  entrever: 'ver',
  rever: 'ver',
  antever: 'ver',
  desoír: 'oir',
  entreoír: 'oir',
  trasoír: 'oir',
  /* Même situation : le segment devant la base ne se découpe pas en préfixes. */
  engreír: 'reir',
  refreír: 'freir',
  sofreír: 'freir',

  // Défectifs
  llover: 'llover',
  nevar: 'nevar',
  concernir: 'concernir',
  soler: 'soler',
  abolir: 'abolir',

  // Alternances vocaliques
  pensar: 'pensar',
  empezar: 'pensar',
  cerrar: 'pensar',
  comenzar: 'pensar',
  entender: 'pensar',
  perder: 'pensar',
  sentar: 'pensar',
  acertar: 'pensar',
  alentar: 'pensar',
  apretar: 'pensar',
  arrendar: 'pensar',
  atravesar: 'pensar',
  calentar: 'pensar',
  cegar: 'pensar',
  concertar: 'pensar',
  confesar: 'pensar',
  despertar: 'pensar',
  fregar: 'pensar',
  gobernar: 'pensar',
  helar: 'pensar',
  manifestar: 'pensar',
  merendar: 'pensar',
  negar: 'pensar',
  plegar: 'pensar',
  quebrar: 'pensar',
  recomendar: 'pensar',
  regar: 'pensar',
  remendar: 'pensar',
  reventar: 'pensar',
  segar: 'pensar',
  sembrar: 'pensar',
  temblar: 'pensar',
  tentar: 'pensar',
  tropezar: 'pensar',
  // `enterrar`, `aterrar` et `desterrar` viennent de *tierra*, pas de `errar` :
  // ils diphtonguent en `ie` normalement, et n'ont pas le `ye-` de `yerro`.
  enterrar: 'pensar',
  aterrar: 'pensar',
  desterrar: 'pensar',
  ascender: 'pensar',
  atender: 'pensar',
  defender: 'pensar',
  descender: 'pensar',
  encender: 'pensar',
  extender: 'pensar',
  tender: 'pensar',
  verter: 'pensar',
  // Le seul -ir à diphtonguer sans jamais s'affaiblir : le prétérit reste
  // régulier, `discirnió` n'existe pas. `concernir` fait de même, mais il est
  // défectif et a donc son propre modèle.
  discernir: 'pensar',
  contar: 'contar',
  encontrar: 'contar',
  recordar: 'contar',
  mostrar: 'contar',
  probar: 'contar',
  sonar: 'contar',
  soñar: 'contar',
  soltar: 'contar',
  volar: 'contar',
  costar: 'contar',
  colgar: 'contar',
  forzar: 'contar',
  acordar: 'contar',
  acostar: 'contar',
  almorzar: 'contar',
  aprobar: 'contar',
  rogar: 'contar',
  mover: 'contar',
  doler: 'contar',
  morder: 'contar',
  moler: 'contar',
  amoblar: 'contar',
  apostar: 'contar',
  colar: 'contar',
  concordar: 'contar',
  consolar: 'contar',
  demostrar: 'contar',
  descollar: 'contar',
  engrosar: 'contar',
  holgar: 'contar',
  poblar: 'contar',
  renovar: 'contar',
  rodar: 'contar',
  soldar: 'contar',
  tostar: 'contar',
  tronar: 'contar',
  trocar: 'contar',
  volcar: 'contar',
  demoler: 'contar',
  // Le u de la diphtongue tombe derrière un g : il faut un tréma pour le garder
  // prononcé — `avergüenzo`, `degüello`, `agüero`.
  avergonzar: 'contar',
  degollar: 'contar',
  agorar: 'contar',
  resolver: 'volver',
  absolver: 'volver',
  disolver: 'volver',
  // `torcer` et `cocer` diphtonguent comme `contar` ; leur c devient z devant o et a,
  // ce que la règle graphique applique seule : tuerzo, cuezo.
  torcer: 'contar',
  cocer: 'contar',
  jugar: 'jugar',
  adquirir: 'adquirir',
  sentir: 'sentir',
  mentir: 'sentir',
  preferir: 'sentir',
  dormir: 'dormir',
  pedir: 'pedir',
  servir: 'pedir',
  repetir: 'pedir',
  seguir: 'pedir',
  conseguir: 'pedir',
  vestir: 'pedir',
  medir: 'pedir',
  elegir: 'pedir',
  corregir: 'pedir',
  impedir: 'pedir',
  despedir: 'pedir',
  competir: 'pedir',
  rendir: 'pedir',
  gemir: 'pedir',
  concebir: 'pedir',
  derretir: 'pedir',
  colegir: 'pedir',
  regir: 'pedir',
  // Le ñ absorbe le i de la terminaison, déjà mouillé : `riñó`, et non `*riñió`.
  // C'est la règle graphique ordinaire, pas une irrégularité de plus.
  ceñir: 'pedir',
  reñir: 'pedir',
  teñir: 'pedir',
  desteñir: 'pedir',
  constreñir: 'pedir',
  advertir: 'sentir',
  convertir: 'sentir',
  divertir: 'sentir',
  herir: 'sentir',
  hervir: 'sentir',
  invertir: 'sentir',
  referir: 'sentir',
  sugerir: 'sentir',
  consentir: 'sentir',
  adherir: 'sentir',
  arrepentir: 'sentir',
  diferir: 'sentir',
  digerir: 'sentir',
  disentir: 'sentir',
  inferir: 'sentir',
  ingerir: 'sentir',
  requerir: 'sentir',
  transferir: 'sentir',
  inquirir: 'adquirir',

  // Alternance et participe irrégulier
  volver: 'volver',
  devolver: 'volver',
  morir: 'morir',
  escribir: 'escribir',
  describir: 'escribir',
  abrir: 'abrir',
  cubrir: 'cubrir',
  descubrir: 'cubrir',
  romper: 'romper',

  // Familles orthographiques et incohatives
  conocer: 'conocer',
  parecer: 'conocer',
  ofrecer: 'conocer',
  agradecer: 'conocer',
  nacer: 'conocer',
  traducir: 'conducir',
  conducir: 'conducir',
  producir: 'conducir',
  construir: 'construir',
  huir: 'construir',
  incluir: 'construir',
  destruir: 'construir',
  enviar: 'enviar',
  guiar: 'enviar',
  actuar: 'actuar',
  continuar: 'actuar',

  // L'accent écrit sépare deux voyelles que l'on prononcerait autrement en une
  // seule syllabe : `reunir` se dit re-ú-no, et non *reuno.
  reunir: 'actuar',
  rehusar: 'actuar',
  aunar: 'actuar',
  prohibir: 'enviar',
  aislar: 'enviar',

  // Composés de `decir` et de `hacer` qui ont refait une partie de leur paradigme.
  bendecir: 'bendecir',
  maldecir: 'bendecir',
  satisfacer: 'hacer',
}

/**
 * Verbes de base dont les dérivés préfixés se conjuguent à l'identique :
 * `obtener`, `mantener`, `detener` suivent `tener` jusqu'à la dernière lettre.
 * Cette dérivation évite de lister des centaines de dérivés — et surtout d'en oublier.
 *
 * N'y faire figurer qu'un verbe qui a réellement des dérivés : chaque base ajoutée
 * est une occasion supplémentaire de capturer un verbe sans rapport.
 */
const DERIVABLE = [
  'tener',
  'venir',
  'poner',
  'hacer',
  'decir',
  'traer',
  'salir',
  'caer',
  'valer',
  'volver',
  'mover',
  'contar',
  'pensar',
  'sentir',
  'dormir',
  'pedir',
  'seguir',
  'vestir',
  'sentar',
  'cerrar',
  'entender',
  'escribir',
  'cubrir',
  'abrir',
  'morir',
  'jugar',
  'probar',
  'sonar',
  'volar',
  'colgar',
  'forzar',
  'torcer',
  'cocer',
  'andar',
  'moler',
  'reír',
  'poblar',
  'rodar',
  'tender',
  'negar',
  'apretar',
  'quebrar',
  'ceñir',
  'teñir',
]
  // Le suffixe le plus long d'abord : `devolver` doit résoudre vers `volver`,
  // et surtout pas vers `ver`.
  .sort((a, b) => b.length - a.length)

/**
 * Longueur minimale d'un verbe de base dérivable. En dessous, la coïncidence de
 * suffixe l'emporte sur la parenté réelle : `subir` se termine par `ir` et
 * commence par le préfixe `sub`, sans être pour autant un dérivé du verbe `ir`.
 * Les rares dérivés des verbes courts — `prever`, `desoír` — sont donc inscrits
 * un par un dans `VERB_MODELS`.
 */
const MIN_BASE_LENGTH = 4

/**
 * Préfixes verbaux espagnols. Un dérivé, c'est un préfixe collé à un verbe de
 * base — `de` + `volver`, `ob` + `tener`, `entre` + `tener` — et rien d'autre.
 * Sans cette contrainte, la seule comparaison de suffixe ferait de `vivir` un
 * dérivé de `ir` et de `dirigir` un autre, et le moteur conjuguerait `vivo`
 * en `voy`.
 *
 * Les préfixes se composent (`des` + `com` + `poner`, `pre` + `su` + `poner`),
 * d'où la décomposition en chaîne plutôt qu'une simple appartenance.
 */
const PREFIXES = [
  'a',
  'ab',
  'abs',
  'ad',
  'ante',
  'anti',
  'auto',
  'ben',
  'bien',
  'circun',
  'co',
  'com',
  'con',
  'contra',
  'de',
  'des',
  'dis',
  'em',
  'en',
  'entre',
  'equi',
  'es',
  'ex',
  'extra',
  'im',
  'in',
  'inter',
  'intro',
  'mal',
  // `mantener` vient de *manu tenere* : le préfixe est bien `man`, pas `ma`.
  'man',
  'o',
  'ob',
  'per',
  'pos',
  'post',
  'pre',
  'pro',
  're',
  'retro',
  'so',
  'sobre',
  'son',
  'sos',
  'su',
  'sub',
  'super',
  'sus',
  'tra',
  'tras',
  'trans',
  'yuxta',
]

/**
 * Le segment placé devant la base se découpe-t-il entièrement en préfixes connus ?
 *
 * `descomponer` donne `descom` = `des` + `com`, donc oui ; `vivir` donne `viv`,
 * qui ne se découpe pas, donc non. Le découpage est cherché de gauche à droite
 * par programmation dynamique, parce que le premier préfixe reconnu n'est pas
 * toujours le bon : dans `sobreponer`, `so` mène à une impasse et `sobre` aboutit.
 */
function isPrefixChain(segment: string): boolean {
  if (segment.length === 0) return false

  const reachable = new Array<boolean>(segment.length + 1).fill(false)
  reachable[0] = true
  for (let end = 1; end <= segment.length; end++) {
    reachable[end] = PREFIXES.some(
      (prefix) =>
        prefix.length <= end &&
        reachable[end - prefix.length] === true &&
        segment.startsWith(prefix, end - prefix.length),
    )
  }
  return reachable[segment.length]!
}

/**
 * Patrons de suffixe qui définissent une famille entière. C'est ainsi que les
 * grammaires les décrivent, et c'est la seule façon de couvrir le long terme :
 * tout verbe en -ecer est incohatif, sans qu'on ait à l'inscrire nulle part.
 */
const SUFFIX_FAMILIES: Array<{ test: (verb: string) => boolean; model: string }> = [
  { test: (v) => v.endsWith('ducir'), model: 'conducir' },
  // -uir, mais ni -guir (le u est muet) ni -quir.
  {
    test: (v) => v.endsWith('uir') && !v.endsWith('guir') && !v.endsWith('quir'),
    model: 'construir',
  },
  { test: (v) => v.endsWith('ecer') || v.endsWith('ocer'), model: 'conocer' },
  // `-ucir` sans le prétérit fort des `-ducir`, déjà captés au-dessus :
  // `lucir` fait `luzco` mais `lució`, pas `*luje`.
  { test: (v) => v.endsWith('ucir'), model: 'conocer' },
]

/**
 * Verbes dont la terminaison suggère une famille à laquelle ils n'appartiennent pas.
 * Sans cette liste, `mecer` deviendrait `mezco` au lieu de `mezo`, et `escocer`
 * serait rangé chez les incohatifs au lieu de suivre `cocer`.
 */
const NOT_A_FAMILY = new Set(['mecer', 'remecer', 'escocer'])

/**
 * Verbes qui ressemblent à un dérivé sans en être un : leur début se découpe bien
 * en préfixes, mais ils n'ont jamais été formés sur le verbe qu'ils semblent
 * contenir et se conjuguent régulièrement. `presentar` n'est pas un `sentar`
 * préfixé (on dit `presento`, pas `presiento`), `compensar` pas un `pensar`,
 * `conjugar` pas un `jugar`.
 */
const NOT_A_DERIVATIVE = new Set([
  'presentar',
  'representar',
  'compensar',
  'dispensar',
  'recompensar',
  'conjugar',
  'subjugar',
  'personar',
])

/**
 * Préfixe d'un verbe inscrit explicitement dans `VERB_MODELS`, déduit du verbe qui
 * donne son nom au modèle.
 *
 * `prever` pointe vers le modèle `ver`, dont l'exemple est `ver` : le préfixe est
 * donc `pre`, et les formes figées du modèle — `veo`, `visto` — lui reviennent
 * sous la forme `preveo`, `previsto`. Sans cela, l'inscription explicite d'un
 * dérivé lui ferait perdre son préfixe et rendrait les formes du verbe simple.
 *
 * La déduction ne se déclenche que sur une vraie parenté de forme : `empezar`
 * pointe vers `pensar` sans se terminer par `pensar`, et garde un préfixe vide.
 */
function prefixAgainst(infinitive: string, modelId: string): string {
  const example = MODELS[modelId]?.example
  if (example === undefined || example === infinitive) return ''
  return infinitive.endsWith(example) ? infinitive.slice(0, -example.length) : ''
}

/** Ce que l'attribution d'un modèle apprend sur un verbe. */
export interface Derivation {
  /** Identifiant du modèle, ou `null` si le verbe est régulier. */
  modelId: string | null
  /**
   * Préfixe par lequel le verbe se distingue du verbe de base de son modèle.
   * Vide dès que le verbe n'est pas un dérivé — donc dans l'immense majorité
   * des cas, y compris pour tous les verbes réguliers.
   */
  prefix: string
}

const REGULAR: Derivation = { modelId: null, prefix: '' }

/**
 * Attribue son modèle à un verbe.
 *
 * Ordre strict, premier gagnant : table explicite, puis familles de suffixe, puis
 * dérivation préfixée. Les deux dernières étapes sont des heuristiques — utiles
 * pour un verbe que le Conjugueur rencontre sans qu'il figure dans les données,
 * mais c'est `VERB_MODELS` qui fait autorité, et c'est là qu'on tranche un cas
 * douteux plutôt qu'en élargissant une heuristique.
 */
export function resolveDerivation(infinitive: string): Derivation {
  const explicit = VERB_MODELS[infinitive]
  if (explicit) return { modelId: explicit, prefix: prefixAgainst(infinitive, explicit) }

  if (!NOT_A_FAMILY.has(infinitive)) {
    for (const family of SUFFIX_FAMILIES) {
      // Une famille de suffixe décrit le verbe entier, pas un verbe de base
      // préfixé : `traducir` n'est pas `tra` + `ducir`. Le préfixe reste vide.
      if (family.test(infinitive)) return { modelId: family.model, prefix: '' }
    }
  }

  if (!NOT_A_DERIVATIVE.has(infinitive)) {
    for (const base of DERIVABLE) {
      if (base.length < MIN_BASE_LENGTH) continue
      // Un dérivé, pas le verbe lui-même — celui-ci est déjà dans la table explicite.
      if (!infinitive.endsWith(base) || infinitive.length <= base.length) continue
      const prefix = infinitive.slice(0, -base.length)
      if (!isPrefixChain(prefix)) continue
      const modelId = VERB_MODELS[base]
      return modelId ? { modelId, prefix } : REGULAR
    }
  }
  return REGULAR
}

/** Identifiant du modèle d'un verbe, ou `null` s'il est régulier. */
export function resolveModelId(infinitive: string): string | null {
  return resolveDerivation(infinitive).modelId
}

export function modelFor(infinitive: string, conjugation: Conjugation): Model {
  const { modelId } = resolveDerivation(infinitive)
  return (modelId ? MODELS[modelId] : undefined) ?? REGULAR_MODELS[conjugation]
}
