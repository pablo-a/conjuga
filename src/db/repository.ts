import { conjugationOf, modelFor } from '@/conjugation'
import type { Person } from '@/conjugation'
import { parseCardId } from '@/srs/curriculum'
import type { CardId, Progress } from '@/srs/curriculum'
import type { PatternCount } from '@/srs/patterns'
import { applyReview, newCardState } from '@/srs/scheduler'
import type { Grade } from '@/srs/scheduler'
import type { DeckEntry } from '@/srs/selector'
import { dayKey } from '@/srs/streak'

import { db } from './index'
import type { Answer, StudyDay } from './index'

/**
 * Ce que l'application demande à la persistance — et rien d'autre.
 *
 * Le reste du code ne touche jamais Dexie : les modules de `src/srs` et
 * `src/exercises` sont purs par construction, et c'est ici que leur vocabulaire
 * (`DeckEntry`, `Progress`, `Grade`) rencontre les tables de `src/db/index.ts`.
 * Un seul endroit sait donc écrire, ce qui est la condition pour que l'écriture
 * soit transactionnelle.
 */

/** Une réponse à ranger, telle que la session la produit. */
export interface AnswerDraft {
  person: Person
  expected: string
  given: string
  correct: boolean
  accentOnly: boolean
  elapsedMs: number
}

/** Une carte close : ses réponses, et la note qu'elles valent à la carte entière. */
export interface ReviewToSave {
  card: CardId
  grade: Grade
  answers: readonly AnswerDraft[]
  at: Date
}

/**
 * L'état de progression complet, lu en une passe.
 *
 * Le sélecteur veut des échéances, le curriculum veut des stabilités : les deux
 * sortent de la même table, et les lire séparément la parcourrait deux fois pour
 * répondre à la même question — « où en est-on ? ».
 */
export interface Snapshot {
  deck: DeckEntry[]
  progress: Progress
}

export async function loadSnapshot(): Promise<Snapshot> {
  const cards = await db.cards.toArray()
  return {
    deck: cards.map((card) => ({ id: card.id, due: card.due })),
    // FSRS exprime la stabilité en jours, ce qu'attend `MASTERY_STABILITY_DAYS`.
    progress: new Map(cards.map((card) => [card.id, card.fsrs.stability])),
  }
}

/**
 * Les personnes sur lesquelles chaque carte a trébuché la dernière fois.
 *
 * On regarde la **dernière** réponse connue pour chaque couple (carte, personne),
 * pas l'historique entier : une personne ratée il y a six mois puis retrouvée
 * trois fois depuis n'est plus une faiblesse, et la traiter comme telle
 * condamnerait le tirage à repasser éternellement sur les mêmes cases.
 *
 * La faute d'accent compte comme un échec ici, alors que le SRS la traite plus
 * doucement : l'accent tonique se travaille exactement en reposant la personne.
 */
export async function weakPersons(cards: readonly CardId[]): Promise<Map<CardId, Person[]>> {
  if (cards.length === 0) return new Map()

  const answers = await db.answers
    .where('cardId')
    .anyOf(cards as CardId[])
    .toArray()

  const latest = new Map<string, Answer>()
  for (const answer of answers) {
    const key = `${answer.cardId}|${answer.person}`
    const known = latest.get(key)
    if (!known || known.answeredAt.getTime() <= answer.answeredAt.getTime()) latest.set(key, answer)
  }

  const weak = new Map<CardId, Person[]>()
  for (const answer of latest.values()) {
    if (answer.correct) continue
    const persons = weak.get(answer.cardId) ?? []
    persons.push(answer.person as Person)
    weak.set(answer.cardId, persons)
  }
  return weak
}

/**
 * Le modèle auquel une carte rattache ses statistiques.
 *
 * Une carte ne naît que d'un verbe que le moteur sait conjuguer — le curriculum
 * écarte les autres en tentant la conjugaison — donc la terminaison est connue
 * et `conjugationOf` ne peut pas échouer ici.
 */
function modelOf(lemma: string): string {
  return modelFor(lemma, conjugationOf(lemma)!).id
}

/**
 * Range une révision : l'état FSRS de la carte, le détail des réponses et
 * l'agrégat par (modèle, temps), en une seule transaction.
 *
 * L'atomicité n'est pas décorative : une carte repoussée dont les réponses
 * n'auraient pas été écrites ferait disparaître une faiblesse sans laisser de
 * trace, et l'app proposerait la théorie d'un patron que l'apprenant maîtrise.
 */
export async function saveReview(review: ReviewToSave): Promise<void> {
  const { lemma, tense } = parseCardId(review.card)
  const model = modelOf(lemma)
  const patternId = `${model}:${tense}`

  /*
   * Ce qui compte comme erreur du patron, c'est de ne pas avoir trouvé la forme.
   * Une faute d'accent seul dit que la règle a été appliquée et que la syllabe
   * tonique a été manquée : la compter ici gonflerait le taux d'échec des
   * modèles les plus accentués et enverrait l'apprenant vers la mauvaise fiche.
   */
  const errors = review.answers.filter((answer) => !answer.correct && !answer.accentOnly).length

  await db.transaction('rw', db.cards, db.answers, db.patternStats, db.days, async () => {
    const existing = await db.cards.get(review.card)
    const before = existing?.fsrs ?? newCardState(review.at)
    const { state, due } = applyReview(before, review.grade, review.at)

    await db.cards.put({
      id: review.card,
      lemma,
      tense,
      fsrs: state,
      due,
      reps: (existing?.reps ?? 0) + 1,
      lapses: (existing?.lapses ?? 0) + (review.grade === 'again' ? 1 : 0),
    })

    await db.answers.bulkAdd(
      review.answers.map((answer) => ({
        ...answer,
        cardId: review.card,
        answeredAt: review.at,
      })),
    )

    const stat = await db.patternStats.get(patternId)
    await db.patternStats.put({
      id: patternId,
      model,
      tense,
      attempts: (stat?.attempts ?? 0) + review.answers.length,
      errors: (stat?.errors ?? 0) + errors,
    })

    /*
     * La série se marque ici et pas à l'ouverture de la session : ce qui compte
     * comme un jour travaillé, c'est une carte réellement révisée. Ouvrir l'app,
     * lire la question et fermer l'onglet ne fait pas une journée.
     */
    const key = dayKey(review.at)
    const day = await db.days.get(key)
    await db.days.put({
      id: key,
      cards: (day?.cards ?? 0) + 1,
      answers: (day?.answers ?? 0) + review.answers.length,
    })
  })
}

/**
 * Tous les agrégats `(modèle, temps)`.
 *
 * Rendus bruts, sans agrégation ni classement : ce qu'on en tire — taux de
 * réussite, patrons les plus ratés, seuil en deçà duquel on ne conclut rien —
 * relève de `srs/patterns.ts`, où c'est testable sans base. La table est bornée
 * par le nombre de modèles fois le nombre de temps, soit quelques centaines de
 * lignes au grand maximum.
 */
export async function loadPatternStats(): Promise<PatternCount[]> {
  return db.patternStats.toArray()
}

/**
 * Les jours travaillés, du plus ancien au plus récent.
 *
 * Rendus en entier plutôt que filtrés : la table porte une ligne par jour, donc
 * une année d'assiduité tient en 365 enregistrements, et la série comme le
 * total du jour se lisent d'une seule passe.
 */
export async function loadStudyDays(): Promise<StudyDay[]> {
  return db.days.orderBy('id').toArray()
}
