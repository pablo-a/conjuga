import Dexie, { type EntityTable } from 'dexie'

import type { CardState } from '@/srs/scheduler'
import { dayKey } from '@/srs/streak'

/**
 * Persistance locale. Aucun serveur : toute la progression vit dans IndexedDB,
 * et l'export/import JSON est le seul mécanisme de sauvegarde.
 *
 * Une `Card` est un couple (lemma, tense) — la personne est tirée au sort à chaque
 * révision, elle ne fait donc pas partie de l'identité de la carte. Voir PLAN.md §2.
 */

/** État de répétition espacée d'un couple (lemma, tense). */
export interface Card {
  id: string
  /** Infinitif espagnol, ex. `pensar`. */
  lemma: string
  /** Identifiant de temps, ex. `indicativo.presente`. */
  tense: string
  /**
   * État FSRS de la carte. Il est rangé tel quel : `ts-fsrs` n'expose que des
   * nombres et des `Date`, que le clonage structuré d'IndexedDB sait déjà porter,
   * et le sérialiser à la main ferait deux formats à maintenir au lieu d'un.
   */
  fsrs: CardState
  /** Prochaine échéance, dénormalisée pour pouvoir l'indexer. */
  due: Date
  /** Nombre de révisions et d'échecs, pour les statistiques. */
  reps: number
  lapses: number
}

/** Une réponse individuelle, conservée pour les statistiques par personne et par modèle. */
export interface Answer {
  id?: number
  cardId: string
  answeredAt: Date
  person: string
  /**
   * Le format sous lequel la question a été posée.
   *
   * Ce n'est pas une donnée d'affichage : c'est ce qui permet de ne compter que
   * la production là où seule la production fait preuve. Reconnaître une forme
   * parmi quatre et l'écrire ne mesurent pas la même chose, et les additionner
   * ferait dériver le taux d'échec d'un patron au gré du mélange d'exercices.
   */
  kind: 'drill' | 'choice' | 'identify'
  expected: string
  given: string
  correct: boolean
  /** Vrai quand la seule erreur portait sur un accent : on le distingue d'une faute de forme. */
  accentOnly: boolean
  /** Durée de réflexion en millisecondes, utilisée pour le budget temps de la session. */
  elapsedMs: number
}

/** Agrégat par (modèle, temps) : c'est lui qui pilote les suggestions de théorie. */
export interface PatternStat {
  id: string
  model: string
  tense: string
  attempts: number
  errors: number
}

/**
 * Un jour où l'apprenant s'est mis à sa session.
 *
 * C'est un agrégat, pas un cache : la série et le « déjà fait aujourd'hui » de
 * l'accueil se lisent à chaque ouverture de l'app, et les recalculer depuis le
 * journal des réponses ferait de la requête la plus fréquente la plus coûteuse —
 * une année de sessions pèse ~40 000 réponses pour 365 jours.
 */
export interface StudyDay {
  /** Jour civil local, `AAAA-MM-JJ`. Voir `dayKey` pour le choix du fuseau. */
  id: string
  /** Cartes révisées ce jour-là, toutes sessions confondues. */
  cards: number
  /** Formes demandées ce jour-là. */
  answers: number
  /**
   * Cartes **distinctes** du programme du jour : celles qui étaient dues, plus
   * les nouveautés. C'est ce compteur qui dépense le budget quotidien, et donc ce
   * qui permet à une journée de se terminer.
   *
   * Deux sortes de révisions n'y comptent pas. La **repasse** — FSRS ramène une
   * carte neuve dix minutes plus tard — parce qu'elle achève un travail déjà
   * compté, et la compter deux fois ferait grossir l'objectif du jour à mesure
   * qu'on le remplit. La révision **en avance**, le drill lancé depuis une fiche,
   * parce qu'elle ne fait avancer aucune échéance : la faire peser sur le budget
   * laisserait croire la journée finie alors que les cartes dues attendent.
   */
  planned: number
  /**
   * Nouveautés découvertes ce jour-là. Le plafond de dix cartes neuves est un
   * plafond **journalier** : sans ce compteur, chaque session en rouvrirait dix
   * de plus et le programme n'aurait pas de fin.
   */
  introduced: number
}

export const db = new Dexie('conjuga') as Dexie & {
  cards: EntityTable<Card, 'id'>
  answers: EntityTable<Answer, 'id'>
  patternStats: EntityTable<PatternStat, 'id'>
  days: EntityTable<StudyDay, 'id'>
}

db.version(1).stores({
  cards: 'id, lemma, tense, due',
  answers: '++id, cardId, answeredAt',
  patternStats: 'id, model, tense',
})

db.version(2)
  .stores({ days: 'id' })
  .upgrade(async (transaction) => {
    /*
     * La table est dérivable du journal des réponses, qui existe déjà : une base
     * déjà remplie doit retrouver sa série intacte, sinon la migration punirait
     * l'apprenant le plus assidu — celui qui a le plus de jours à perdre.
     */
    const answers = await transaction.table<Answer>('answers').toArray()

    const days = new Map<string, { cards: Set<string>; answers: number }>()
    for (const answer of answers) {
      const key = dayKey(answer.answeredAt)
      const day = days.get(key) ?? { cards: new Set<string>(), answers: 0 }
      day.cards.add(answer.cardId)
      day.answers += 1
      days.set(key, day)
    }

    // Les compteurs du programme du jour restent à zéro : c'est la version 4 qui
    // les renseigne, et elle passe juste après sur les lignes écrites ici.
    await transaction.table<StudyDay>('days').bulkAdd(
      [...days].map(([id, day]) => ({
        id,
        cards: day.cards.size,
        answers: day.answers,
        planned: 0,
        introduced: 0,
      })),
    )
  })

db.version(3).upgrade(async (transaction) => {
  /*
   * Avant la reconnaissance, tout ce qui était rangé venait du drill. On le dit
   * explicitement plutôt que de laisser des lignes sans `kind` : ce champ décide
   * de ce qui compte comme preuve de production, et un `undefined` s'y lirait
   * tôt ou tard comme « pas une production », effaçant l'historique de qui a le
   * plus travaillé.
   */
  await transaction
    .table<Answer>('answers')
    .toCollection()
    .modify((answer) => {
      answer.kind = 'drill'
    })
})

db.version(4).upgrade(async (transaction) => {
  /*
   * Les deux compteurs de la journée. Ils entrent dans des soustractions — budget
   * restant, nouveautés restantes — donc les laisser absents ne donnerait pas
   * « zéro » mais `NaN`, et une base d'avant la mise à jour n'aurait plus de
   * séance du jour du tout.
   *
   * `introduced` se retrouve exactement : une carte est découverte le jour de sa
   * première réponse. `planned` ne se retrouve pas — rien n'a jamais dit si une
   * révision passée était due ou en avance — et on prend le total. C'est le choix
   * conservateur : au pire, le jour de la migration, une séance déjà entamée
   * paraît un peu plus avancée qu'elle ne l'est.
   */
  const answers = await transaction.table<Answer>('answers').toArray()

  const discovered = new Map<string, Date>()
  for (const answer of answers) {
    const known = discovered.get(answer.cardId)
    if (known === undefined || answer.answeredAt.getTime() < known.getTime()) {
      discovered.set(answer.cardId, answer.answeredAt)
    }
  }

  const perDay = new Map<string, number>()
  for (const at of discovered.values()) {
    const key = dayKey(at)
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }

  await transaction
    .table<StudyDay>('days')
    .toCollection()
    .modify((day) => {
      day.planned = day.cards
      day.introduced = perDay.get(day.id) ?? 0
    })
})
