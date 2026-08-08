/**
 * Distille l'extraction du Wiktionnaire français en une table
 * « lemme espagnol → gloses françaises », versionnée dans `data/wiktionary/`.
 *
 * La source fait 257 Mo décompressés et n'a pas sa place dans le dépôt. Le
 * distillat, lui, y est : il fixe ce sur quoi la relecture humaine va porter, et
 * évite que `build-verb-list` dépende d'un téléchargement à chaque exécution.
 *
 * Usage :
 *   npm run data:wiktionary -- [chemin/vers/kaikki.jsonl]
 *
 * Sans argument, le fichier est téléchargé dans un répertoire temporaire.
 *
 * Source : https://kaikki.org/frwiktionary/Espagnol/ (extraction wiktextract du
 * Wiktionnaire francophone). Contenu sous CC BY-SA — voir CREDITS.md.
 */
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'data/wiktionary/es-verbs.json')
/**
 * Mots espagnols qui existent aussi hors du verbe.
 *
 * Sert à repérer les homographes lors du classement par fréquence : `para` pèse
 * 2,8 millions d'occurrences, mais c'est la préposition, pas `parar` à la
 * troisième personne. Sans cette liste, l'agrégation propulserait des verbes
 * rares en tête du classement.
 */
const NON_VERBS_OUTPUT = resolve(ROOT, 'data/wiktionary/es-non-verbs.json')
const SOURCE_URL = 'https://kaikki.org/frwiktionary/Espagnol/kaikki.org-dictionary-Espagnol.jsonl'

/** Une entrée du JSONL de wiktextract, réduite à ce dont on se sert. */
interface Entry {
  word?: string
  pos?: string
  lang_code?: string
  tags?: string[]
  senses?: Array<{
    glosses?: string[]
    /** Renseigné quand le sens n'est qu'un renvoi vers un lemme : `tengo` → `tener`. */
    form_of?: Array<{ word?: string }>
  }>
}

export interface VerbEntry {
  /** Gloses françaises, dans l'ordre du Wiktionnaire — la première est la principale. */
  glosses: string[]
  /** Étiquettes du Wiktionnaire (`irregular`, `transitive`, `pronominal`…). */
  tags?: string[]
}

/**
 * Une entrée est un lemme si *aucun* de ses sens n'est un simple renvoi.
 *
 * Le Wiktionnaire décrit chaque forme conjuguée comme une entrée à part entière :
 * `tengo` y est un « verb » au même titre que `tener`. Sans ce tri, on prendrait
 * 162 767 formes fléchies pour autant de verbes.
 */
function isLemma(entry: Entry): boolean {
  const senses = entry.senses ?? []
  if (senses.length === 0) return false
  return !senses.every((sense) => (sense.form_of?.length ?? 0) > 0)
}

/** Les gloses utiles : celles qui décrivent le sens, pas celles qui renvoient ailleurs. */
function glossesOf(entry: Entry): string[] {
  const glosses = (entry.senses ?? [])
    .filter((sense) => (sense.form_of?.length ?? 0) === 0)
    .flatMap((sense) => sense.glosses ?? [])
    .map((gloss) => gloss.trim())
    .filter((gloss) => gloss.length > 0)

  return [...new Set(glosses)]
}

async function download(): Promise<string> {
  const target = resolve(tmpdir(), 'kaikki-es.jsonl')
  if (existsSync(target)) {
    console.log(`Source déjà présente : ${target}`)
    return target
  }
  console.log(`Téléchargement de ${SOURCE_URL}…`)
  const response = await fetch(SOURCE_URL)
  if (!response.ok) throw new Error(`Téléchargement échoué : HTTP ${response.status}`)
  writeFileSync(target, Buffer.from(await response.arrayBuffer()))
  return target
}

async function main() {
  const given = process.argv[2]
  const source = given ? resolve(given) : await download()

  const verbs = new Map<string, VerbEntry>()
  const nonVerbs = new Set<string>()
  let scanned = 0
  let inflected = 0

  const lines = createInterface({
    input: createReadStream(source),
    crlfDelay: Infinity,
  })

  for await (const line of lines) {
    if (line.trim().length === 0) continue
    let entry: Entry
    try {
      entry = JSON.parse(line) as Entry
    } catch {
      continue
    }
    if (entry.lang_code !== 'es' || !entry.word) continue

    if (entry.pos !== 'verb') {
      // Une forme fléchie de nom ou d'adjectif compte aussi : `vino` est un nom,
      // `sobre` une préposition, et tous deux ressemblent à une forme verbale.
      nonVerbs.add(entry.word)
      continue
    }
    scanned++

    if (!isLemma(entry)) {
      inflected++
      continue
    }
    const glosses = glossesOf(entry)
    if (glosses.length === 0) continue

    // Un lemme peut apparaître plusieurs fois (étymologies distinctes) : on
    // réunit les sens plutôt que d'en perdre.
    const existing = verbs.get(entry.word)
    if (existing) {
      existing.glosses = [...new Set([...existing.glosses, ...glosses])]
      continue
    }
    verbs.set(entry.word, {
      glosses,
      ...(entry.tags && entry.tags.length > 0 ? { tags: entry.tags } : {}),
    })
  }

  const sorted = [...verbs.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, `${JSON.stringify(Object.fromEntries(sorted), null, 1)}\n`, 'utf8')

  // Un mot qui est aussi un verbe n'est pas un homographe : on ne garde que ce
  // qui n'existe qu'en dehors du verbe.
  const purelyNonVerb = [...nonVerbs]
    .filter((word) => !verbs.has(word))
    .sort((a, b) => a.localeCompare(b, 'es'))
  writeFileSync(NON_VERBS_OUTPUT, `${JSON.stringify(purelyNonVerb)}\n`, 'utf8')

  console.log(`Entrées « verbe » lues   : ${scanned}`)
  console.log(`Formes fléchies écartées : ${inflected}`)
  console.log(`Lemmes retenus           : ${verbs.size}`)
  console.log(`Mots non verbaux         : ${purelyNonVerb.length}`)
  console.log(`Écrit dans               : ${OUTPUT}`)
  console.log(`                           ${NON_VERBS_OUTPUT}`)
}

await main()
