import { conjugationOf, modelFor } from '@/conjugation'
import type { Person } from '@/conjugation'
import type { ExerciseKind } from '@/exercises/session'
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
  kind: ExerciseKind
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
    // `lastReview` permet au sélecteur de reconnaître une repasse : sans elle, la
    // seconde vue d'une nouveauté passerait pour une carte de plus à faire.
    deck: cards.map((card) => ({
      id: card.id,
      due: card.due,
      lastReview: card.fsrs.last_review ?? null,
    })),
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
 *
 * Seule la **production** est regardée. La règle « la dernière réponse fait foi »
 * ne supporte pas le mélange : une reconnaissance réussie effacerait une
 * faiblesse de production, alors qu'elle ne prouve pas qu'on sache écrire la
 * forme — et sur une carte neuve les deux portent le même horodatage, donc
 * l'ordre lui-même serait affaire de chance.
 */
export async function weakPersons(cards: readonly CardId[]): Promise<Map<CardId, Person[]>> {
  if (cards.length === 0) return new Map()

  const answers = await db.answers
    .where('cardId')
    .anyOf(cards as CardId[])
    .toArray()

  const latest = new Map<string, Answer>()
  for (const answer of answers) {
    if (answer.kind !== 'drill') continue
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
   * L'agrégat des patrons ne compte que la **production**. Le mélange
   * d'exercices évoluera — plus de reconnaissance sur les cartes neuves, moins
   * ensuite — et additionner les deux ferait bouger le taux d'échec d'un patron
   * sans que l'apprenant ait changé, ce qui rendrait la mesure incomparable dans
   * le temps et la suggestion de l'accueil erratique.
   *
   * Parmi celles-ci, ce qui compte comme erreur, c'est de ne pas avoir trouvé la
   * forme. Une faute d'accent seul dit que la règle a été appliquée et que la
   * syllabe tonique a été manquée : la compter ici gonflerait le taux d'échec des
   * modèles les plus accentués et enverrait l'apprenant vers la mauvaise fiche.
   */
  const produced = review.answers.filter((answer) => answer.kind === 'drill')
  const errors = produced.filter((answer) => !answer.correct && !answer.accentOnly).length

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
      attempts: (stat?.attempts ?? 0) + produced.length,
      errors: (stat?.errors ?? 0) + errors,
    })

    /*
     * La série se marque ici et pas à l'ouverture de la session : ce qui compte
     * comme un jour travaillé, c'est une carte réellement révisée. Ouvrir l'app,
     * lire la question et fermer l'onglet ne fait pas une journée.
     */
    const key = dayKey(review.at)
    const day = await db.days.get(key)

    /*
     * Ce que la carte coûte au programme du jour, et il y a deux façons de ne
     * rien coûter du tout :
     *
     * - la **repasse** — FSRS ramène une carte neuve dix minutes après, et une
     *   carte ratée dans la minute. Cette seconde vue achève un travail déjà
     *   compté ; la compter deux fois ferait grossir l'objectif du jour à mesure
     *   qu'on le remplit, ce qui est précisément l'effet qu'on veut éviter ;
     * - la révision **en avance** — le drill lancé depuis une fiche, un
     *   supplément qui ne doit pas manger le budget de la séance ordinaire, seule
     *   à suivre l'ordre du programme.
     *
     * Reste ce qui fait avancer la journée : une découverte, ou une carte due.
     */
    const repeated = existing?.fsrs.last_review != null && dayKey(existing.fsrs.last_review) === key
    const discovered = existing === undefined
    const scheduled = existing !== undefined && existing.due.getTime() <= review.at.getTime()
    const advances = !repeated && (discovered || scheduled)

    await db.days.put({
      id: key,
      cards: (day?.cards ?? 0) + 1,
      answers: (day?.answers ?? 0) + review.answers.length,
      planned: (day?.planned ?? 0) + (advances ? 1 : 0),
      introduced: (day?.introduced ?? 0) + (discovered ? 1 : 0),
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

/**
 * Ce que la journée en cours a déjà consommé.
 *
 * Rendu même quand rien n'a été fait, avec des zéros plutôt qu'un `undefined` :
 * le sélecteur en soustrait les compteurs, et une journée jamais ouverte est une
 * journée dont le budget est entier — pas une absence de réponse.
 */
export async function loadDay(now: Date): Promise<StudyDay> {
  const key = dayKey(now)
  return (await db.days.get(key)) ?? { id: key, cards: 0, answers: 0, planned: 0, introduced: 0 }
}
