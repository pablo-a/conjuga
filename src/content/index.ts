import type { Tense } from '@/conjugation'

/**
 * Le catalogue des fiches de théorie : ce que chacune enseigne, et à quel temps
 * elle répond. **Rien que des données** — le contenu compilé vit dans
 * `sheets.ts`, et cette séparation n'est pas cosmétique.
 *
 * Trois écrans lisent ce catalogue sans afficher la moindre fiche : l'accueil y
 * cherche vers quoi renvoyer, la Pratique vers quoi enchaîner, la liste de la
 * Théorie n'affiche que des titres. Or l'accueil est la première route, chargée
 * d'emblée : y importer les huit fiches ferait tomber ~60 Ko de théorie dans le
 * paquet initial pour n'en montrer aucune ligne.
 */

export interface Sheet {
  /** Segment d'URL, en français comme le reste des routes. */
  slug: string
  title: string
  /** Ce que la fiche enseigne, en une phrase, pour la liste. */
  summary: string
  /**
   * Les temps que la fiche couvre. Sert à deux choses : mesurer la maîtrise
   * affichée en regard, et savoir vers quelle fiche la Pratique renvoie après
   * une correction.
   */
  tenses: readonly Tense[]
}

/**
 * L'ordre compte deux fois : c'est celui de la liste affichée, et `sheetFor`
 * retient la **première** fiche qui couvre un temps. Les fiches dédiées passent
 * donc avant les transversales — `indefinido` et `imperfecto` ont chacune la
 * leur, et « Indefinido ou imperfecto » se glisse derrière, juste après la paire
 * qu'elle arbitre.
 *
 * La suite reprend l'ordre du curriculum (voir `srs/curriculum.ts`) : on lit la
 * théorie d'un temps au moment où les cartes l'introduisent, pas avant.
 */
const sheets: Sheet[] = [
  {
    slug: 'present',
    title: 'Le présent de l’indicatif',
    summary:
      'La botte des diphtongues, les premières personnes en -go et -zco, et pourquoi on n’écrit pas le pronom sujet.',
    tenses: ['indicativo.presente'],
  },
  {
    slug: 'passe-compose',
    title: 'Le passé composé (pretérito perfecto)',
    summary:
      'Onze participes irréguliers, un seul auxiliaire, et un participe qui ne s’accorde jamais.',
    tenses: ['indicativo.perfecto'],
  },
  {
    slug: 'passe-simple',
    title: 'Le passé simple (pretérito indefinido)',
    summary:
      'Les prétérits forts et leur accent absent — un temps littéraire en français, quotidien en espagnol.',
    tenses: ['indicativo.indefinido'],
  },
  {
    slug: 'imparfait',
    title: 'L’imparfait (imperfecto)',
    summary: 'Trois irréguliers en tout, des accents partout, et deux personnes identiques.',
    tenses: ['indicativo.imperfecto'],
  },
  {
    slug: 'indefinido-ou-imperfecto',
    title: 'Indefinido ou imperfecto',
    summary:
      'Le piège numéro un du francophone : la ligne de partage espagnole n’est pas celle du passé composé et de l’imparfait.',
    tenses: ['indicativo.indefinido', 'indicativo.imperfecto'],
  },
  {
    slug: 'futur-et-conditionnel',
    title: 'Le futur et le conditionnel',
    summary:
      'Un radical pour deux temps, douze verbes qui l’altèrent, et un futur qui sert surtout à supposer.',
    tenses: ['indicativo.futuro', 'indicativo.condicional'],
  },
  {
    slug: 'imperatif',
    title: 'L’impératif',
    summary:
      'Un temps sans terminaisons à lui, huit formes à retenir, et un négatif qui n’est pas l’affirmatif.',
    tenses: ['imperativo.afirmativo', 'imperativo.negativo'],
  },
  {
    slug: 'subjonctif-present',
    title: 'Le présent du subjonctif',
    summary:
      'Le mode que le français a laissé s’éteindre : d’où sortent les formes, et ce qui les déclenche.',
    tenses: ['subjuntivo.presente'],
  },
]

export const SHEETS: readonly Sheet[] = sheets

/**
 * Tous les temps qu'au moins une fiche explique.
 *
 * Sert à borner la recherche d'une faiblesse à montrer : désigner un patron raté
 * sur un temps sans fiche donnerait un constat sans issue, alors que le sens de
 * la suggestion est justement de mener quelque part.
 */
export const COVERED_TENSES: readonly Tense[] = [
  ...new Set(sheets.flatMap((sheet) => sheet.tenses)),
]

export function sheetBySlug(slug: string): Sheet | undefined {
  return sheets.find((sheet) => sheet.slug === slug)
}

/** La fiche vers laquelle renvoyer après une question à ce temps, s'il y en a une. */
export function sheetFor(tense: Tense): Sheet | undefined {
  return sheets.find((sheet) => sheet.tenses.includes(tense))
}
