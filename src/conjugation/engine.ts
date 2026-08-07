import { accentLastVowel } from './accents'
import { differenceSpan } from './diff'
import {
  ENDINGS,
  NON_FINITE_ENDINGS,
  PERSON_INDEX,
  STRONG_PRETERITE_ENDINGS,
  SUBJUNCTIVE_FUTURE,
  SUBJUNCTIVE_IMPERFECT_RA,
  SUBJUNCTIVE_IMPERFECT_SE,
  conjugationOf,
  stemOf,
  vosotrosImperative,
} from './endings'
import type { EndingSet, EndingTableId } from './endings'
import { DEFAULT_REASONS, MODELS, REGULAR_MODELS, modelFor } from './models'
import type { Model, Slot, StemContext } from './models'
import { joinWithOrthography } from './orthography'
import { COMPOUND_AUXILIARY, PERSONS, isCompoundTense } from './types'
import type { Irregularity, MaybeForm, Person, SimpleTense, Tense } from './types'

export class NotAVerbError extends Error {
  constructor(word: string) {
    super(
      `« ${word} » n'est pas un infinitif conjugable : attendu une terminaison -ar, -er ou -ir.`,
    )
    this.name = 'NotAVerbError'
  }
}

function contextOf(infinitive: string): StemContext {
  const conjugation = conjugationOf(infinitive)
  // `ir` est le seul verbe espagnol réduit à sa terminaison : son radical est vide.
  if (!conjugation || (infinitive.length < 3 && infinitive !== 'ir')) {
    throw new NotAVerbError(infinitive)
  }
  return { infinitive, stem: stemOf(infinitive), conjugation, orthography: true }
}

/**
 * Trace de construction d'une forme : quels emplacements ont dévié de la règle
 * régulière, et quelles adaptations graphiques ont joué. Sert à expliquer l'écart
 * plutôt qu'à seulement le constater.
 */
interface Trace {
  slots: Set<Slot>
  rules: Set<string>
}

const newTrace = (): Trace => ({ slots: new Set(), rules: new Set() })

/** Les personnes dont la terminaison du présent est atone : le radical n'y diphtongue pas. */
const UNSTRESSED_PRESENT: ReadonlySet<Person> = new Set<Person>(['nosotros', 'vosotros'])

/** Colle radical et terminaison, en appliquant les adaptations graphiques si demandé. */
function join(ctx: StemContext, trace: Trace, stem: string, ending: string): string {
  if (!ctx.orthography) return stem + ending
  const { value, rule } = joinWithOrthography(ctx.conjugation, stem, ending, ctx.stem)
  if (rule) {
    trace.slots.add('orthographic')
    trace.rules.add(rule)
  }
  return value
}

function override(model: Model, key: string, trace: Trace): string | undefined {
  const value = model.forms?.[key]
  if (value !== undefined) trace.slots.add('forms')
  return value
}

function endingFor(table: EndingTableId, ctx: StemContext, person: Person): string {
  const set: EndingSet = ENDINGS[table][ctx.conjugation]
  return set[PERSON_INDEX[person]]
}

function presentStem(ctx: StemContext, model: Model, person: Person, trace: Trace): string {
  if (!UNSTRESSED_PRESENT.has(person) && model.presentStressedStem) {
    trace.slots.add('present')
    return model.presentStressedStem(ctx)
  }
  if (model.presentStem) {
    trace.slots.add('present')
    return model.presentStem(ctx)
  }
  return ctx.stem
}

function presentForm(ctx: StemContext, model: Model, person: Person, trace: Trace): string {
  const forced = override(model, `indicativo.presente:${person}`, trace)
  if (forced !== undefined) return forced

  if (person === 'yo' && model.yo) {
    trace.slots.add('yo')
    return model.yo(ctx)
  }
  const stem = presentStem(ctx, model, person, trace)
  return join(ctx, trace, stem, endingFor('indicativo.presente', ctx, person))
}

/**
 * Le subjonctif présent se construit sur la première personne du singulier de
 * l'indicatif présent, privée de son `-o` : `hago` → `haga`, `conozco` → `conozca`.
 * La règle explique à elle seule la majorité des subjonctifs dits irréguliers, et
 * c'est pour cela qu'on la calcule plutôt que de la tabuler.
 */
function subjunctiveStem(ctx: StemContext, model: Model, person: Person, trace: Trace): string {
  if (UNSTRESSED_PRESENT.has(person) && model.subjunctiveNosStem) {
    trace.slots.add('subjunctive')
    return model.subjunctiveNosStem(ctx)
  }
  if (model.subjunctiveStem) {
    trace.slots.add('subjunctive')
    return model.subjunctiveStem(ctx)
  }

  // On dérive de `yo`, mais sans ses adaptations graphiques : celles-ci dépendent
  // de la terminaison qui suit, et le subjonctif n'a pas les mêmes que le présent.
  const bare: StemContext = { ...ctx, orthography: false }
  const yoForm = presentForm(bare, model, 'yo', trace)
  return yoForm.endsWith('o') ? yoForm.slice(0, -1) : ctx.stem
}

function subjunctivePresentForm(
  ctx: StemContext,
  model: Model,
  person: Person,
  trace: Trace,
): string {
  const forced = override(model, `subjuntivo.presente:${person}`, trace)
  if (forced !== undefined) return forced

  const stem = subjunctiveStem(ctx, model, person, trace)
  return join(ctx, trace, stem, endingFor('subjuntivo.presente', ctx, person))
}

function preteriteForm(ctx: StemContext, model: Model, person: Person, trace: Trace): string {
  const forced = override(model, `indicativo.indefinido:${person}`, trace)
  if (forced !== undefined) return forced

  if (model.strongPreterite) {
    trace.slots.add('preterite')
    const stem = model.preteriteStem?.(ctx) ?? ctx.stem
    // Un radical en -j absorbe le i de la seule terminaison `-ieron` : `dijeron`,
    // mais `dijiste` et `dijimos` gardent le leur.
    const ending = STRONG_PRETERITE_ENDINGS[PERSON_INDEX[person]]
    return stem + (stem.endsWith('j') && ending === 'ieron' ? 'eron' : ending)
  }

  const third = person === 'el' || person === 'ellos'
  const special = third ? model.preteriteThirdStem : undefined
  const stem = special?.(ctx) ?? model.preteriteStem?.(ctx) ?? ctx.stem
  if (special ?? model.preteriteStem) trace.slots.add('preterite')
  return join(ctx, trace, stem, endingFor('indicativo.indefinido', ctx, person))
}

/**
 * Le subjonctif imparfait et le subjonctif futur se construisent sur la troisième
 * personne du pluriel du prétérit privée de son `-ron`, sans aucune exception.
 * L'accent de la première personne du pluriel remonte d'une syllabe.
 */
function fromPreteriteRoot(
  ctx: StemContext,
  model: Model,
  person: Person,
  trace: Trace,
  endings: EndingSet,
): string {
  const third = preteriteForm(ctx, model, 'ellos', trace)
  const root = third.endsWith('ron') ? third.slice(0, -3) : third
  const base = person === 'nosotros' ? accentLastVowel(root) : root
  return base + endings[PERSON_INDEX[person]]
}

function futureBase(ctx: StemContext, model: Model, trace: Trace): string {
  if (model.futureStem) {
    trace.slots.add('future')
    return model.futureStem(ctx)
  }
  return ctx.infinitive
}

function imperfectForm(ctx: StemContext, model: Model, person: Person, trace: Trace): string {
  const forced = override(model, `indicativo.imperfecto:${person}`, trace)
  if (forced !== undefined) return forced

  if (model.imperfectStem) trace.slots.add('imperfect')
  const stem = model.imperfectStem?.(ctx) ?? ctx.stem
  return stem + endingFor('indicativo.imperfecto', ctx, person)
}

/**
 * L'impératif n'a pas de terminaisons propres : il emprunte le présent de
 * l'indicatif pour `tú`, le subjonctif pour les formes de politesse et de
 * première personne du pluriel, et l'infinitif pour `vosotros`.
 */
function affirmativeImperative(
  ctx: StemContext,
  model: Model,
  person: Person,
  trace: Trace,
): string | null {
  if (person === 'yo') return null

  const forced = override(model, `imperativo.afirmativo:${person}`, trace)
  if (forced !== undefined) return forced

  if (person === 'tu') {
    if (model.imperativeTu) {
      trace.slots.add('imperativeTu')
      return model.imperativeTu(ctx)
    }
    return presentForm(ctx, model, 'el', trace)
  }
  if (person === 'vosotros') return vosotrosImperative(ctx.infinitive)
  return subjunctivePresentForm(ctx, model, person, trace)
}

function gerundOf(ctx: StemContext, model: Model, trace: Trace): string {
  if (model.gerundio) {
    trace.slots.add('gerundio')
    return model.gerundio(ctx)
  }
  return join(ctx, trace, ctx.stem, NON_FINITE_ENDINGS[ctx.conjugation].gerundio)
}

function participleOf(ctx: StemContext, model: Model, trace: Trace): string {
  if (model.participio) {
    trace.slots.add('participio')
    return model.participio(ctx)
  }
  return join(ctx, trace, ctx.stem, NON_FINITE_ENDINGS[ctx.conjugation].participio)
}

/** Construit une forme de temps simple, sans analyse des irrégularités. */
function buildSimple(
  ctx: StemContext,
  model: Model,
  tense: SimpleTense,
  person: Person,
  trace: Trace,
): string | null {
  switch (tense) {
    case 'indicativo.presente':
      return presentForm(ctx, model, person, trace)
    case 'indicativo.imperfecto':
      return imperfectForm(ctx, model, person, trace)
    case 'indicativo.indefinido':
      return preteriteForm(ctx, model, person, trace)
    case 'indicativo.futuro':
      return futureBase(ctx, model, trace) + endingFor('indicativo.futuro', ctx, person)
    case 'indicativo.condicional':
      return futureBase(ctx, model, trace) + endingFor('indicativo.condicional', ctx, person)
    case 'subjuntivo.presente':
      return subjunctivePresentForm(ctx, model, person, trace)
    case 'subjuntivo.imperfecto':
      return fromPreteriteRoot(ctx, model, person, trace, SUBJUNCTIVE_IMPERFECT_RA)
    case 'subjuntivo.futuro':
      return fromPreteriteRoot(ctx, model, person, trace, SUBJUNCTIVE_FUTURE)
    case 'imperativo.afirmativo':
      return affirmativeImperative(ctx, model, person, trace)
    case 'imperativo.negativo':
      return person === 'yo' ? null : subjunctivePresentForm(ctx, model, person, trace)
  }
}

/** Contexte et modèle de `haber`, auxiliaire de tous les temps composés. */
const HABER_CONTEXT = contextOf('haber')
const HABER_MODEL = MODELS.haber!

function auxiliaryFor(
  tense: (typeof COMPOUND_AUXILIARY)[keyof typeof COMPOUND_AUXILIARY],
  person: Person,
): string | null {
  return buildSimple(HABER_CONTEXT, HABER_MODEL, tense, person, newTrace())
}

function buildAny(
  ctx: StemContext,
  model: Model,
  tense: Tense,
  person: Person,
  trace: Trace,
): string | null {
  if (!isCompoundTense(tense)) return buildSimple(ctx, model, tense, person, trace)

  // L'auxiliaire est toujours `haber` : son irrégularité n'est pas celle du verbe
  // conjugué, on ne la compte donc pas dans les écarts signalés à l'apprenant.
  const auxiliary = auxiliaryFor(COMPOUND_AUXILIARY[tense], person)
  if (auxiliary === null) return null
  return `${auxiliary} ${participleOf(ctx, model, trace)}`
}

/** Variantes également correctes d'une même cellule. */
function alternativesFor(ctx: StemContext, model: Model, tense: Tense, person: Person): string[] {
  const scratch = newTrace()
  const found = model.alternativeForms?.[`${tense}:${person}`] ?? []

  if (tense === 'subjuntivo.imperfecto') {
    return [...found, fromPreteriteRoot(ctx, model, person, scratch, SUBJUNCTIVE_IMPERFECT_SE)]
  }

  if (tense === 'subjuntivo.pluscuamperfecto') {
    const auxiliary = fromPreteriteRoot(
      HABER_CONTEXT,
      HABER_MODEL,
      person,
      scratch,
      SUBJUNCTIVE_IMPERFECT_SE,
    )
    return [...found, `${auxiliary} ${participleOf(ctx, model, scratch)}`]
  }

  const extra = model.participioAlternatives
  if (extra && isCompoundTense(tense)) {
    const auxiliary = auxiliaryFor(COMPOUND_AUXILIARY[tense], person)
    if (auxiliary !== null) return [...found, ...extra.map((fn) => `${auxiliary} ${fn(ctx)}`)]
  }

  return found
}

function irregularitiesOf(
  model: Model,
  trace: Trace,
  regular: string,
  actual: string,
): Irregularity[] {
  const span = differenceSpan(regular, actual)
  if (span === null) return []

  const slots: Slot[] = trace.slots.size > 0 ? [...trace.slots] : ['forms']
  const seen = new Set<string>()
  const result: Irregularity[] = []

  for (const slot of slots) {
    // Les adaptations graphiques portent leur propre explication, bien plus utile
    // que le libellé générique de l'emplacement.
    if (slot === 'orthographic') {
      for (const rule of trace.rules) {
        result.push({ kind: 'orthographic', explanation: rule, span })
      }
      continue
    }
    const reason = model.reasons?.[slot] ?? model.reasons?.default ?? DEFAULT_REASONS[slot]
    const key = `${reason.kind}:${reason.explanation}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({
      kind: reason.kind,
      explanation: reason.explanation,
      span: locate(reason, actual, span),
    })
  }
  return result
}

/**
 * Étend le segment surligné au motif complet quand le modèle en désigne un.
 * La comparaison brute entre `penso` et `pienso` n'isole que le `i` ajouté, alors
 * que le patron à retenir est `ie`.
 */
function locate(
  reason: { segment?: string },
  actual: string,
  span: [number, number],
): [number, number] {
  const segment = reason.segment
  if (!segment) return span

  const from = Math.max(0, span[0] - segment.length + 1)
  const index = actual.indexOf(segment, from)
  if (index < 0 || index > span[0]) return span
  return [index, index + segment.length]
}

/** Conjugue une cellule. Renvoie `null` si la cellule n'existe pas (yo à l'impératif). */
export function conjugate(infinitive: string, tense: Tense, person: Person): MaybeForm {
  const ctx = contextOf(infinitive)
  const model = modelFor(infinitive, ctx.conjugation)

  const trace = newTrace()
  const value = buildAny(ctx, model, tense, person, trace)
  if (value === null) return null

  // La référence régulière est produite par le même moteur, avec le modèle régulier
  // du groupe et sans adaptation graphique : toute divergence est donc imputable
  // au verbe lui-même, et explicable.
  const bare: StemContext = { ...ctx, orthography: false }
  const regular =
    buildAny(bare, REGULAR_MODELS[ctx.conjugation], tense, person, newTrace()) ?? value

  return {
    value,
    alternatives: alternativesFor(ctx, model, tense, person),
    regular,
    irregularities: irregularitiesOf(model, trace, regular, value),
  }
}

/** Les six cellules d'un temps, dans l'ordre de `PERSONS`. */
export function conjugateAll(infinitive: string, tense: Tense): MaybeForm[] {
  return PERSONS.map((person) => conjugate(infinitive, tense, person))
}

export interface NonFiniteForms {
  infinitivo: string
  gerundio: string
  participio: string
}

/** Infinitif, gérondif et participe passé. */
export function nonFinite(infinitive: string): NonFiniteForms {
  const ctx = contextOf(infinitive)
  const model = modelFor(infinitive, ctx.conjugation)
  const trace = newTrace()
  return {
    infinitivo: infinitive,
    gerundio: gerundOf(ctx, model, trace),
    participio: participleOf(ctx, model, trace),
  }
}
