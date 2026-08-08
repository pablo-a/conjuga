/**
 * Construit `src/data/verbs.json` : les verbes espagnols les plus fréquents, avec
 * leur modèle de conjugaison et leurs traductions françaises. Et `lemmas.json`,
 * qui n'en garde que les infinitifs — c'est lui, et lui seul, que l'app embarque.
 *
 * Usage : npm run data:verbs
 *
 * ## Pourquoi ce n'est pas un simple filtrage
 *
 * La liste de fréquence ne connaît que des **formes** : `es` y est au rang 8 sans
 * que rien ne le rattache à `ser`, et les formes de `tener` sont éparpillées sur
 * des centaines de rangs. Filtrer les mots en -ar, -er, -ir donnerait le rang de
 * l'infinitif, qui n'a rien à voir avec celui du verbe — `ser` ne s'emploie
 * presque jamais à l'infinitif.
 *
 * On procède donc à l'envers : pour chaque verbe connu du Wiktionnaire, le moteur
 * génère son paradigme complet, et l'on somme les occurrences de toutes ses
 * formes. C'est un usage du moteur qu'aucune table figée n'aurait permis.
 *
 * ## Ce que le script ne tranche pas
 *
 * Deux ambiguïtés lui échappent par construction, et sont donc **signalées** dans
 * `data/verbs-review.md` plutôt que devinées :
 *
 *  - les homographes — `para` pèse 2,8 millions d'occurrences, mais c'est la
 *    préposition, pas `parar` à la troisième personne ;
 *  - les traductions — les gloses du Wiktionnaire sont des définitions, pas des
 *    équivalents prêts à afficher.
 *
 * Le champ `reviewed` reste donc à `false` jusqu'à relecture humaine.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { conjugate, nonFinite, resolveModelId } from '../src/conjugation/index.ts'
import { SIMPLE_TENSES, PERSONS } from '../src/conjugation/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FREQUENCY = resolve(ROOT, 'data/frequency/es_50k.txt')
const WIKTIONARY = resolve(ROOT, 'data/wiktionary/es-verbs.json')
const NON_VERBS = resolve(ROOT, 'data/wiktionary/es-non-verbs.json')
const OUTPUT = resolve(ROOT, 'src/data/verbs.json')
const REVIEW = resolve(ROOT, 'data/verbs-review.md')

/**
 * Les mêmes verbes, réduits à leur infinitif et au même ordre.
 *
 * C'est le seul des deux fichiers que le navigateur télécharge. Le curriculum n'a
 * besoin que du classement pour savoir quelles cartes ouvrir, alors que
 * `verbs.json` porte surtout des gloses — 110 Ko contre 10 Ko, et des définitions
 * non relues que rien ne devrait afficher tant qu'elles n'ont pas été corrigées.
 */
const LEMMAS = resolve(ROOT, 'src/data/lemmas.json')

/** Nombre de verbes retenus. PLAN.md §1 : les 1000 les plus fréquents. */
const KEEP = 1000

/**
 * Au-delà de ce rapport entre masse ambiguë et masse propre, le verbe doit
 * l'essentiel de son rang à des mots qui n'ont probablement rien à voir avec lui.
 */
const BORROWED_ALERT = 4

interface Candidate {
  infinitive: string
  /** Occurrences des formes qui n'existent qu'en tant que formes verbales. */
  unambiguous: number
  /** Occurrences de toutes les formes, homographes compris. */
  total: number
  /** Les formes homographes les plus lourdes, pour que la relecture ait prise. */
  borrowed: Array<{ form: string; count: number }>
  /** Formes disputées perdues au profit d'un verbe plus établi. */
  lost: Array<{ form: string; count: number; winner: string }>
  glosses: string[]
}

interface VerbRecord {
  es: string
  fr: string[]
  rank: number
  model: string | null
  /** Occurrences cumulées de toutes les formes du verbe dans le corpus. */
  frequency: number
  /** Passe à `true` quand un humain a validé la traduction. PLAN.md §5. */
  reviewed: boolean
}

function readFrequencies(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const line of readFileSync(FREQUENCY, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue
    const [word, count] = line.split(' ')
    if (!word || !count) continue
    counts.set(word, Number(count))
  }
  return counts
}

/**
 * Toutes les formes simples d'un verbe, dédoublonnées.
 *
 * Les temps composés sont écartés : ce sont deux mots (`he hablado`) et le corpus
 * compte des jetons isolés. Leur participe est de toute façon déjà là.
 *
 * Le dédoublonnage est indispensable : `hablamos` est à la fois présent et
 * prétérit, et le compter deux fois gonflerait le verbe sans raison.
 */
function formsOf(infinitive: string): Set<string> {
  const forms = new Set<string>()
  for (const tense of SIMPLE_TENSES) {
    for (const person of PERSONS) {
      const form = conjugate(infinitive, tense, person)
      if (!form) continue
      forms.add(form.value)
      for (const alternative of form.alternatives) forms.add(alternative)
    }
  }
  const { infinitivo, gerundio, participio } = nonFinite(infinitive)
  forms.add(infinitivo)
  forms.add(gerundio)
  forms.add(participio)
  return forms
}

function main() {
  const counts = readFrequencies()
  const wiktionary = JSON.parse(readFileSync(WIKTIONARY, 'utf8')) as Record<
    string,
    { glosses: string[] }
  >
  const nonVerbs = new Set(JSON.parse(readFileSync(NON_VERBS, 'utf8')) as string[])

  const paradigms = new Map<string, Set<string>>()
  let skipped = 0

  for (const infinitive of Object.keys(wiktionary)) {
    // Le moteur ne conjugue pas les pronominaux : `abalanzarse` attendra que la
    // question du pronom réfléchi soit tranchée.
    if (!/(ar|er|ir|ír)$/.test(infinitive) || infinitive.includes(' ')) {
      skipped++
      continue
    }
    try {
      paradigms.set(infinitive, formsOf(infinitive))
    } catch {
      skipped++
    }
  }

  /*
   * Une même forme appartient souvent à plusieurs verbes.
   *
   * `podría` est le conditionnel de `poder` et l'imparfait de `podrir` ; `siento`
   * est `sentir` et `sentar` ; `podemos` est `poder` et le subjonctif de `podar`.
   * Le corpus ne compte qu'un jeton : le porter au crédit des deux verbes
   * hisserait « pourrir » et « élaguer » au niveau de « pouvoir ».
   */
  const claimants = new Map<string, string[]>()
  for (const [infinitive, forms] of paradigms) {
    for (const form of forms) {
      const list = claimants.get(form)
      if (list) list.push(infinitive)
      else claimants.set(form, [infinitive])
    }
  }

  /**
   * Masse **exclusive** d'un verbe : les formes qui n'appartiennent qu'à lui et
   * n'existent pas hors du verbe. C'est le socle indiscutable de sa fréquence.
   */
  const exclusive = new Map<string, number>()
  for (const [infinitive, forms] of paradigms) {
    let mass = 0
    for (const form of forms) {
      if (nonVerbs.has(form)) continue
      if ((claimants.get(form)?.length ?? 0) > 1) continue
      mass += counts.get(form) ?? 0
    }
    exclusive.set(infinitive, mass)
  }

  /**
   * Chaque forme disputée revient **au verbe le plus solidement établi**, celui
   * dont la masse exclusive est la plus grande. Le corpus n'ayant qu'un jeton, il
   * faut bien trancher, et l'attribuer au verbe manifestement plus courant est le
   * pari le moins mauvais — c'est presque toujours celui que le locuteur a dit.
   *
   * Les formes qui existent hors du verbe ne sont attribuées à personne : entre
   * `nada` « rien » et `nada` « il nage », le corpus ne dit rien, et le mot non
   * verbal l'emporte trop souvent pour qu'on parie dessus.
   */
  const awarded = new Map<string, number>()
  const contested = new Map<string, Array<{ form: string; count: number; winner: string }>>()

  for (const [form, verbs] of claimants) {
    const count = counts.get(form) ?? 0
    if (count === 0 || nonVerbs.has(form)) continue

    const winner = verbs.reduce((best, verb) =>
      (exclusive.get(verb) ?? 0) > (exclusive.get(best) ?? 0) ? verb : best,
    )
    awarded.set(winner, (awarded.get(winner) ?? 0) + count)

    if (verbs.length > 1) {
      for (const loser of verbs) {
        if (loser === winner) continue
        const list = contested.get(loser) ?? []
        list.push({ form, count, winner })
        contested.set(loser, list)
      }
    }
  }

  const candidates: Candidate[] = []
  for (const [infinitive, forms] of paradigms) {
    const unambiguous = awarded.get(infinitive) ?? 0

    let total = 0
    const borrowed: Array<{ form: string; count: number }> = []
    for (const form of forms) {
      const count = counts.get(form) ?? 0
      if (count === 0) continue
      total += count
      if (nonVerbs.has(form)) borrowed.push({ form, count })
    }
    if (total === 0) continue

    borrowed.sort((a, b) => b.count - a.count)
    const lost = (contested.get(infinitive) ?? []).sort((a, b) => b.count - a.count)

    candidates.push({
      infinitive,
      unambiguous,
      total,
      borrowed: borrowed.slice(0, 3),
      lost: lost.slice(0, 3),
      glosses: wiktionary[infinitive]!.glosses,
    })
  }

  candidates.sort(
    (a, b) => b.unambiguous - a.unambiguous || a.infinitive.localeCompare(b.infinitive, 'es'),
  )
  const kept = candidates.slice(0, KEEP)

  const verbs: VerbRecord[] = kept.map((candidate, index) => ({
    es: candidate.infinitive,
    fr: candidate.glosses.slice(0, 4),
    rank: index + 1,
    model: resolveModelId(candidate.infinitive),
    frequency: candidate.unambiguous,
    reviewed: false,
  }))

  writeFileSync(OUTPUT, `${JSON.stringify(verbs, null, 1)}\n`, 'utf8')
  writeFileSync(
    LEMMAS,
    `${JSON.stringify(
      verbs.map((verb) => verb.es),
      null,
      1,
    )}\n`,
    'utf8',
  )
  writeFileSync(REVIEW, reviewReport(kept, candidates.length, skipped), 'utf8')

  const flagged = kept.filter(isBorrowed)
  console.log(`Candidats évalués   : ${candidates.length} (${skipped} écartés)`)
  console.log(`Verbes retenus      : ${verbs.length}`)
  console.log(`Avec modèle explicite : ${verbs.filter((verb) => verb.model !== null).length}`)
  console.log(`À relire (homographes) : ${flagged.length}`)
  console.log(`Écrit dans          : ${OUTPUT}`)
  console.log(`                      ${LEMMAS}`)
  console.log(`                      ${REVIEW}`)
}

/** Le rang de ce verbe tient-il surtout à des formes qui ne lui appartiennent pas ? */
function isBorrowed(candidate: Candidate): boolean {
  const borrowedMass = candidate.total - candidate.unambiguous
  return borrowedMass > candidate.unambiguous * BORROWED_ALERT
}

function reviewReport(kept: Candidate[], evaluated: number, skipped: number): string {
  const flagged = kept.filter(isBorrowed)
  const longGlosses = kept.filter((candidate) => (candidate.glosses[0]?.length ?? 0) > 60)

  const lines = [
    '# Relecture de la liste de verbes',
    '',
    '> Généré par `npm run data:verbs`. Ne pas modifier à la main : corriger la',
    "> source ou le script, puis régénérer. Les décisions humaines s'inscrivent",
    '> dans `src/data/verbs.json` en passant `reviewed` à `true`.',
    '',
    `Candidats évalués : ${evaluated} · retenus : ${kept.length} · écartés avant évaluation : ${skipped}`,
    '',
    '## Homographes probables',
    '',
    'Le classement ignore déjà les formes qui existent hors du verbe. Ces verbes-là',
    "restent suspects : la masse écartée dépasse de loin celle qu'ils gardent en propre.",
    'Vérifier que le verbe mérite sa place, et le retirer de la source sinon.',
    '',
    '| Rang | Verbe | Propre | Empruntée | Formes empruntées | Sens français |',
    '| ---: | --- | ---: | ---: | --- | --- |',
    ...flagged.map((candidate) => {
      const rank = kept.indexOf(candidate) + 1
      const borrowedMass = candidate.total - candidate.unambiguous
      const forms = candidate.borrowed
        .map((entry) => `\`${entry.form}\` (${entry.count})`)
        .join(', ')
      return `| ${rank} | \`${candidate.infinitive}\` | ${candidate.unambiguous} | ${borrowedMass} | ${forms} | ${candidate.glosses[0] ?? ''} |`
    }),
    '',
    '## Formes disputées, attribuées ailleurs',
    '',
    "Ces verbes partagent une forme fréquente avec un verbe plus établi, qui l'a",
    "emportée. Si une attribution paraît fausse, c'est ici qu'il faut le voir.",
    '',
    '| Verbe | Forme | Occurrences | Attribuée à |',
    '| --- | --- | ---: | --- |',
    ...kept
      .filter((candidate) => candidate.lost.length > 0)
      .flatMap((candidate) =>
        candidate.lost.map(
          (entry) =>
            `| \`${candidate.infinitive}\` | \`${entry.form}\` | ${entry.count} | \`${entry.winner}\` |`,
        ),
      )
      .slice(0, 50),
    '',
    '## Gloses trop longues pour être affichées telles quelles',
    '',
    'Le Wiktionnaire donne des définitions, pas des équivalents. Ces entrées demandent',
    'une traduction courte avant de servir dans un exercice.',
    '',
    ...longGlosses
      .slice(0, 60)
      .map(
        (candidate) =>
          `- \`${candidate.infinitive}\` — ${candidate.glosses[0] ?? '(aucune glose)'}`,
      ),
    '',
    longGlosses.length > 60 ? `_… et ${longGlosses.length - 60} autres._` : '',
  ]
  return `${lines.filter((line) => line !== undefined).join('\n')}\n`
}

main()
