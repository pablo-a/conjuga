import type { Conjugation, IrregularityKind, Person } from './types'

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

const literal =
  (value: string): StemFn =>
  () =>
    value

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
 * Diphtongaison simple : la voyelle du radical se dédouble sous l'accent tonique,
 * donc partout sauf à nosotros et vosotros. C'est la famille la plus peuplée de
 * l'espagnol, et la plus rentable à enseigner comme un patron unique.
 */
const diphthongModel = (id: string, example: string, from: string, to: string): Model => ({
  id,
  example,
  label: `${from} → ${to} sous l'accent tonique (comme ${example})`,
  presentStressedStem: alternate(from, to),
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
  gerundio: (ctx) => replaceLastVowel(ctx.stem, from, weak) + 'iendo',
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
  gerundio: (ctx) => replaceLastVowel(ctx.stem, from, to) + 'iendo',
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

const hacer: Model = {
  id: 'hacer',
  example: 'hacer',
  label: 'yo en -go, prétérit fort hic-, futur syncopé har-, participe hecho',
  yo: literal('hago'),
  preteriteStem: literal('hic'),
  strongPreterite: true,
  // `hizo` et non `hico` : le c devient z devant o pour garder le son.
  forms: { 'indicativo.indefinido:el': 'hizo' },
  futureStem: literal('har'),
  participio: literal('hecho'),
  imperativeTu: literal('haz'),
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
  imperativeTu: literal('di'),
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

/** Verbes réguliers hormis leur participe : `escribir` → `escrito`. */
const irregularParticiple = (id: string, participle: string): Model => ({
  id: `participio-${id}`,
  example: id,
  label: `régulier, mais participe irrégulier en ${participle}`,
  participio: literal(participle),
})

/** Diphtongaison *et* participe irrégulier : `volver` → `vuelvo`, `vuelto`. */
const diphthongWithParticiple = (
  id: string,
  from: string,
  to: string,
  participle: string,
): Model => ({
  ...diphthongModel(id, id, from, to),
  id: `${id}`,
  participio: literal(participle),
  label: `${from} → ${to} sous l'accent tonique, participe irrégulier ${participle}`,
})

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

  volver: diphthongWithParticiple('volver', 'o', 'ue', 'vuelto'),
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

  // Alternances vocaliques
  pensar: 'pensar',
  empezar: 'pensar',
  cerrar: 'pensar',
  comenzar: 'pensar',
  entender: 'pensar',
  perder: 'pensar',
  sentar: 'pensar',
  contar: 'contar',
  encontrar: 'contar',
  recordar: 'contar',
  mostrar: 'contar',
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
}

export function modelFor(infinitive: string, conjugation: Conjugation): Model {
  const id = VERB_MODELS[infinitive]
  return (id ? MODELS[id] : undefined) ?? REGULAR_MODELS[conjugation]
}
